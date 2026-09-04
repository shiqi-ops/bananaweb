"""
Project generation helpers - shared logic reused by both the project controller
and the order service (for auto-generating a PPT after an order is paid).

Kept in the services layer so it has no dependency on controllers, avoiding
circular imports and letting background tasks import it directly.
"""
import logging
from datetime import datetime

from flask import current_app

from models import db, Project, Page, Task, ReferenceFile
from services import ProjectContext, FileService
from services.ai_service_manager import get_ai_service
from services.task_manager import task_manager, generate_images_task
from utils import get_filtered_pages

logger = logging.getLogger(__name__)


def get_project_reference_files_content(project_id: str) -> list:
    """
    Get reference files content for a project.

    Returns a list of dicts with 'filename' and 'content' keys.
    """
    reference_files = ReferenceFile.query.filter_by(
        project_id=project_id,
        parse_status='completed'
    ).all()

    files_content = []
    for ref_file in reference_files:
        if ref_file.markdown_content:
            files_content.append({
                'filename': ref_file.filename,
                'content': ref_file.markdown_content
            })

    return files_content


def reconstruct_outline_from_pages(pages: list) -> list:
    """
    Reconstruct outline structure from Page objects (optional part grouping).
    """
    outline = []
    current_part = None
    current_part_pages = []

    for page in pages:
        outline_content = page.get_outline_content()
        if not outline_content:
            continue

        page_data = outline_content.copy()

        if page.part:
            if current_part and current_part != page.part:
                outline.append({
                    "part": current_part,
                    "pages": current_part_pages
                })
                current_part_pages = []

            current_part = page.part
            if 'part' in page_data:
                del page_data['part']
            current_part_pages.append(page_data)
        else:
            if current_part:
                outline.append({
                    "part": current_part,
                    "pages": current_part_pages
                })
                current_part = None
                current_part_pages = []

            outline.append(page_data)

    if current_part:
        outline.append({
            "part": current_part,
            "pages": current_part_pages
        })

    return outline


def generate_pages_from_description(project_id: str, description_text: str, language: str = 'zh', page_count: int = None) -> list:
    """
    Parse description into an outline + per-page descriptions and create Page records.

    page_count: 可选，限制最终生成的页数（订单等场景按用户要求截断）。
    Returns the list of created Page objects.
    """
    project = Project.query.get(project_id)
    if not project:
        raise ValueError('Project not found')

    if not description_text:
        raise ValueError('description_text is required')

    project.description_text = description_text

    ai_service = get_ai_service()
    project_context = ProjectContext(project, get_project_reference_files_content(project_id))

    outline = ai_service.parse_description_to_outline(project_context, language=language)
    page_descriptions = ai_service.parse_description_to_page_descriptions(
        project_context, outline, language=language
    )
    pages_data = ai_service.flatten_outline(outline)

    if len(pages_data) != len(page_descriptions):
        min_count = min(len(pages_data), len(page_descriptions))
        pages_data = pages_data[:min_count]
        page_descriptions = page_descriptions[:min_count]

    # 按用户要求的页数截断（订单等场景）
    if page_count and page_count > 0:
        pages_data = pages_data[:page_count]
        page_descriptions = page_descriptions[:page_count]

    # Delete existing pages (using ORM session to trigger cascades)
    for old_page in Page.query.filter_by(project_id=project_id).all():
        db.session.delete(old_page)

    pages_list = []
    for i, (page_data, page_desc) in enumerate(zip(pages_data, page_descriptions)):
        page = Page(
            project_id=project_id,
            order_index=i,
            part=page_data.get('part'),
            status='DESCRIPTION_GENERATED'
        )
        page.set_outline_content({
            'title': page_data.get('title'),
            'points': page_data.get('points', [])
        })
        page.set_description_content({
            "text": page_desc,
            "generated_at": datetime.utcnow().isoformat()
        })
        db.session.add(page)
        pages_list.append(page)

    project.status = 'DESCRIPTIONS_GENERATED'
    project.updated_at = datetime.utcnow()

    db.session.commit()

    return pages_list


def submit_image_generation(project_id: str, use_template: bool = True,
                            max_workers: int = None, language: str = None,
                            page_ids: list = None, app=None) -> str:
    """
    Queue image generation for a project's pages in a background task.

    Returns the created Task id.
    """
    project = Project.query.get(project_id)
    if not project:
        raise ValueError('Project not found')

    pages = get_filtered_pages(project_id, page_ids)
    if not pages:
        raise ValueError('No pages found for project')

    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    ref_image_path = None
    if use_template:
        ref_image_path = file_service.get_template_path(project_id)

    if not ref_image_path and not project.template_style:
        raise ValueError('请先上传模板图片或添加风格描述。')

    outline = reconstruct_outline_from_pages(pages)

    if max_workers is None:
        max_workers = current_app.config.get('MAX_IMAGE_WORKERS', 8)
    if language is None:
        language = current_app.config.get('OUTPUT_LANGUAGE', 'zh')

    # Create task
    task = Task(
        project_id=project_id,
        task_type='GENERATE_IMAGES',
        status='PENDING'
    )
    task.set_progress({
        'total': len(pages),
        'completed': 0,
        'failed': 0
    })
    db.session.add(task)
    db.session.commit()

    ai_service = get_ai_service()

    # 合并额外要求和风格描述
    combined_requirements = project.extra_requirements or ""
    if project.template_style:
        style_requirement = f"\n\nppt页面风格描述：\n\n{project.template_style}"
        combined_requirements = combined_requirements + style_requirement

    # Set all target pages to QUEUED before submitting background task
    for page in pages:
        page.status = 'QUEUED'
    db.session.commit()

    app_obj = app or current_app._get_current_object()

    task_manager.submit_task(
        task.id,
        generate_images_task,
        project_id,
        ai_service,
        file_service,
        outline,
        use_template,
        max_workers,
        project.image_aspect_ratio,
        current_app.config['DEFAULT_RESOLUTION'],
        app_obj,
        combined_requirements if combined_requirements.strip() else None,
        language,
        page_ids
    )

    project.status = 'GENERATING_IMAGES'
    db.session.commit()

    return task.id
