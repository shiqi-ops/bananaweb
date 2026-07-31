import io
import json
import logging
import os
import uuid

import fitz
from PIL import Image, ImageDraw, ImageFont
from flask import Blueprint, jsonify, request, send_file, current_app

from models import db, DiagnosisTask, Project

diagnosis_bp = Blueprint('diagnosis_bp', __name__, url_prefix='/api/diagnosis')
logger = logging.getLogger(__name__)

def _render_page_as_image(file_path: str, file_type: str, page_num: int):
    """
    将 PPT/PDF 文件的指定页渲染为 PIL Image。

    返回 PIL.Image 或 None（渲染失败时）。
    """
    if file_type == 'pdf':
        try:
            doc = fitz.open(file_path)
            if page_num < 1 or page_num > len(doc):
                doc.close()
                return None
            page = doc[page_num - 1]
            pix = page.get_pixmap(dpi=150)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            doc.close()
            return img
        except Exception:
            return None

    if file_type == 'pptx':
        # PPTX 无法直接用 fitz 渲染。尝试在同目录下查找同名 PDF。
        base = os.path.splitext(file_path)[0]
        pdf_candidate = base + '.pdf'
        if os.path.exists(pdf_candidate):
            return _render_page_as_image(pdf_candidate, 'pdf', page_num)
        return None

    return None


def _draw_annotations(img: Image.Image, page_data: dict) -> Image.Image:
    """
    在 PIL Image 上绘制诊断标注。

    - layout_issues  → 红色矩形框（精确到 bbox）
    - color_issues   → 橙色标签（左侧列出）
    - logic_issues   → 蓝色标签（底部左侧）
    - text_suggestions → 绿色标签（底部右侧）
    """
    draw = ImageDraw.Draw(img)
    img_w, img_h = img.size

    # --- 字体 ---
    font_paths = [
        os.path.join(os.path.dirname(__file__), '..', 'fonts', 'NotoSansSC-Regular.ttf'),
        os.path.join(os.path.dirname(__file__), '..', 'fonts', 'NotoSansSC-Bold.ttf'),
    ]
    font = None
    font_small = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 16)
                font_small = ImageFont.truetype(fp, 12)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()
        font_small = ImageFont.load_default()

    severity_colors = {
        'high':   (220, 30, 30),
        'medium': (220, 150, 30),
        'low':    (100, 100, 220),
    }

    # ---- layout_issues: 有 bbox，画精确矩形框 ----
    for issue in page_data.get('layout_issues', []):
        bbox = issue.get('bbox')
        if not bbox:
            continue
        x = int(bbox.get('x', 0))
        y = int(bbox.get('y', 0))
        w = int(bbox.get('width', 0))
        h = int(bbox.get('height', 0))
        sev = issue.get('severity', 'medium')
        color = severity_colors.get(sev, (220, 30, 30))

        # 矩形框
        draw.rectangle([(x, y), (x + w, y + h)], outline=color, width=3)

        # 框上方标签
        desc = issue.get('description', '')[:50]
        label = f"[排版·{sev}] {desc}"
        label_y = max(0, y - 20)
        # 标签背景
        bbox_text = draw.textbbox((x, label_y), label, font=font_small)
        tw = bbox_text[2] - bbox_text[0]
        draw.rectangle([(x, label_y), (x + tw + 6, label_y + 18)], fill=color)
        draw.text((x + 3, label_y + 1), label, fill=(255, 255, 255), font=font_small)

    # ---- color_issues: 左上角列出 ----
    color_issues = page_data.get('color_issues', [])
    if color_issues:
        y_off = 10
        for issue in color_issues:
            sev = issue.get('severity', 'medium')
            desc = issue.get('description', '')[:60]
            suggestion = issue.get('suggestion', '')[:40]
            text = f"[配色·{sev}] {desc}"
            if suggestion:
                text += f" → {suggestion}"
            bbox_text = draw.textbbox((10, y_off), text, font=font_small)
            tw = bbox_text[2] - bbox_text[0]
            draw.rectangle([(10, y_off), (12 + tw, y_off + 18)], fill=(240, 140, 30))
            draw.text((12, y_off + 1), text, fill=(255, 255, 255), font=font_small)
            y_off += 22

    # ---- logic_issues: 左下角列出 ----
    logic_issues = page_data.get('logic_issues', [])
    if logic_issues:
        y_off = img_h - 22 * len(logic_issues) - 10
        for issue in logic_issues:
            sev = issue.get('severity', 'low')
            desc = issue.get('description', '')[:60]
            text = f"[逻辑·{sev}] {desc}"
            bbox_text = draw.textbbox((10, y_off), text, font=font_small)
            tw = bbox_text[2] - bbox_text[0]
            draw.rectangle([(10, y_off), (12 + tw, y_off + 18)], fill=(80, 80, 210))
            draw.text((12, y_off + 1), text, fill=(255, 255, 255), font=font_small)
            y_off += 22

    # ---- text_suggestions: 右下角列出 ----
    text_issues = page_data.get('text_suggestions', [])
    if text_issues:
        y_off = img_h - 22 * len(text_issues) - 10
        for s in text_issues:
            original = s.get('original', '')[:25]
            suggested = s.get('suggested', '')[:25]
            label = f"[文字] {original} → {suggested}"
            bbox_text = draw.textbbox((0, 0), label, font=font_small)
            tw = bbox_text[2] - bbox_text[0]
            x_start = img_w - tw - 14
            draw.rectangle([(x_start, y_off), (img_w - 10, y_off + 18)], fill=(50, 160, 50))
            draw.text((x_start + 2, y_off + 1), label, fill=(255, 255, 255), font=font_small)
            y_off += 22

    return img


def _build_optimization_prompt(result: dict) -> str:
    """将诊断结果 JSON 转成 AI 可理解的优化指令文本。"""
    lines = [
        "请根据以下诊断建议对这份 PPT 进行优化改进：",
        "",
        f"整体评分: {result.get('score', 'N/A')}/100",
        f"整体摘要: {result.get('summary', '无')}",
        "",
    ]
    for page in result.get('pages', []):
        page_num = page.get('page_number', '?')
        lines.append(f"## 第 {page_num} 页")

        for issue in page.get('layout_issues', []):
            lines.append(
                f"- [排版 · {issue.get('severity', '')}] {issue.get('description', '')}。"
                f"建议: {issue.get('suggestion', '')}"
            )
        for issue in page.get('color_issues', []):
            lines.append(
                f"- [配色 · {issue.get('severity', '')}] {issue.get('description', '')}。"
                f"建议: {issue.get('suggestion', '')}"
            )
        for issue in page.get('logic_issues', []):
            lines.append(
                f"- [逻辑 · {issue.get('severity', '')}] {issue.get('description', '')}。"
                f"建议: {issue.get('suggestion', '')}"
            )
        for s in page.get('text_suggestions', []):
            lines.append(
                f"- [文字精简] 原文「{s.get('original', '')}」→ "
                f"建议「{s.get('suggested', '')}」。理由: {s.get('reason', '')}"
            )
        lines.append("")

    return '\n'.join(lines)

@diagnosis_bp.route("", methods=['POST'])
def create_diagnosis():
    """提交诊断任务"""
    try:
        data = request.get_json()
        if not data or not data.get('file_path') or not data.get('file_type') or not data.get('diagnosis_options'):
            return jsonify({'code': 400, 'message': '缺少必填字段: file_path, file_type, diagnosis_options'})

        # diagnosis_options 可能是 list 或已序列化的 JSON 字符串
        options = data['diagnosis_options']
        if isinstance(options, list):
            options = json.dumps(options, ensure_ascii=False)

        new_task = DiagnosisTask(
            user_id=data.get('user_id'),
            file_path=data['file_path'],
            file_type=data['file_type'],
            diagnosis_options=options,
        )
        success = DiagnosisTask.create_task(new_task)
        if success:
            from services.task_manager import task_manager
            from services.diagnosis_service import run_diagnosis_task
            app=current_app._get_current_object()
            task_manager.submit_task(new_task.id,run_diagnosis_task,new_task.id,app)
            return jsonify({'code': 200, 'message': '创建成功', 'data': {'task_id': new_task.id}})
        else:
            return jsonify({'code': 500, 'message': '创建失败，数据库写入错误'})
    except Exception as e:
        logger.error(f"创建诊断任务失败: {e}")
        return jsonify({"code": 500, "message": str(e)})


@diagnosis_bp.route("/<string:id>", methods=['GET'])
def get_by_id(id):
    """获取诊断任务状态及结果"""
    try:
        if not id:
            return jsonify({"code": 400, "message": "No id provided"})
        diagnosis = DiagnosisTask.get_by_id(id)
        if diagnosis is None:
            return jsonify({"code": 404, "message": "No diagnosis found"})
        return jsonify({'code': 200, 'data': diagnosis.to_dict()})
    except Exception as e:
        logger.error(f"获取诊断结果失败: {e}")
        return jsonify({'code': 500, 'message': '查询失败，请重新尝试'})


@diagnosis_bp.route("/<string:id>/preview/<int:page_num>", methods=['GET'])
def preview(id, page_num):
    """
    返回指定页的标注预览图（PNG）。

    在文件截图的基础上，用不同颜色的框和标签标注问题区域:
      - layout_issues  → 红色矩形框（精确到 bbox 像素坐标）
      - color_issues   → 橙色标签（左上角）
      - logic_issues   → 蓝色标签（左下角）
      - text_suggestions → 绿色标签（右下角）
    """
    try:
        # 1. 查诊断任务
        if not id:
            return jsonify({"code": 400, "message": "No id provided"})

        task = DiagnosisTask.get_by_id(id)
        if task is None:
            return jsonify({'code': 404, 'message': '诊断任务不存在'})
        if task.status != 'COMPLETED':
            return jsonify({'code': 400, 'message': f'诊断尚未完成，当前状态: {task.status}'})

        # 2. 解析诊断结果
        try:
            result = json.loads(task.result) if task.result else {}
        except (json.JSONDecodeError, TypeError):
            return jsonify({'code': 500, 'message': '诊断结果 JSON 格式错误'})

        # 3. 找到对应页
        page_data = None
        for p in result.get('pages', []):
            if p.get('page_number') == page_num:
                page_data = p
                break
        if page_data is None:
            return jsonify({'code': 404, 'message': f'第 {page_num} 页没有诊断数据'})

        # 4. 渲染原文件为图片
        img = _render_page_as_image(task.file_path, task.file_type, page_num)
        if img is None:
            # 无法渲染 → 生成一张占位画布，仅展示标注信息
            img = Image.new('RGB', (1200, 800), color=(248, 248, 248))
            draw = ImageDraw.Draw(img)
            try:
                font_path = os.path.join(os.path.dirname(__file__), '..', 'fonts', 'NotoSansSC-Regular.ttf')
                placeholder_font = ImageFont.truetype(font_path, 18) if os.path.exists(font_path) else ImageFont.load_default()
            except Exception:
                placeholder_font = ImageFont.load_default()
            draw.text((350, 370),
                      f"⚠ 无法渲染 {task.file_type.upper()} 文件第 {page_num} 页（仅展示标注信息）",
                      fill=(160, 160, 160), font=placeholder_font)

        # 5. 绘制标注
        img = _draw_annotations(img, page_data)

        # 6. 返回 PNG
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return send_file(buf, mimetype='image/png')

    except Exception as e:
        logger.error(f"生成预览图失败: {e}")
        return jsonify({'code': 500, 'message': f'生成预览图失败: {str(e)}'})


@diagnosis_bp.route("/<string:id>/apply", methods=['POST'])
def apply(id):
    """
    一键应用诊断建议：基于诊断结果创建优化版 Project。

    流程:
      1. 读取诊断结果，组装优化 prompt
      2. 创建新 Project
      3. 将原文件关联为新 Project 的参考文件
      4. 异步启动 PPT 翻新流水线（process_ppt_renovation_task）
      5. 返回新 Project ID 和 Task ID，前端可轮询进度
    """
    try:
        # 1. 获取诊断任务
        if not id:
            return jsonify({"code": 400, "message": "No id provided"})

        task = DiagnosisTask.get_by_id(id)
        if task is None:
            return jsonify({'code': 404, 'message': '诊断任务不存在'})
        if task.status != 'COMPLETED':
            return jsonify({'code': 400, 'message': f'诊断尚未完成，当前状态: {task.status}'})

        # 2. 解析诊断结果
        try:
            result = json.loads(task.result) if task.result else {}
        except (json.JSONDecodeError, TypeError):
            return jsonify({'code': 500, 'message': '诊断结果 JSON 格式错误'})

        if not result.get('pages'):
            return jsonify({'code': 400, 'message': '诊断结果中无页面数据，无法生成优化方案'})

        # 3. 构建优化指令
        optimization_prompt = _build_optimization_prompt(result)

        # 用户可额外补充要求
        body = request.get_json() or {}
        extra = body.get('extra_requirements', '')
        if extra:
            optimization_prompt += f"\n\n用户补充要求:\n{extra}"

        # 4. 创建新 Project
        new_project = Project(
            id=str(uuid.uuid4()),
            user_id=task.user_id,
            idea_prompt=optimization_prompt,
            creation_type='ppt_renovation',
            status='DRAFT',
        )
        db.session.add(new_project)
        db.session.commit()
        logger.info(f"[apply] 为诊断 {id} 创建优化项目 {new_project.id}")

        # 5. 关联原文件为参考文件
        renovation_task_id = None
        if os.path.exists(task.file_path):
            try:
                from models import ReferenceFile
                ref_file = ReferenceFile(
                    project_id=new_project.id,
                    filename=os.path.basename(task.file_path),
                    file_path=task.file_path,
                    file_type=task.file_type,
                    parse_status='pending',
                )
                db.session.add(ref_file)
                db.session.commit()
            except Exception as e:
                logger.warning(f"[apply] 关联参考文件失败（非致命）: {e}")

        # 6. 提交翻新任务
        try:
            from flask import current_app
            from services.task_manager import task_manager, process_ppt_renovation_task
            from services.ai_service_manager import get_ai_service
            from services.file_service import FileService
            from services.file_parser_service import FileParserService
            from models import Task as TaskModel

            app_obj = current_app._get_current_object() if current_app else None

            # 创建 Task 记录
            ren_task = TaskModel(
                id=str(uuid.uuid4()),
                project_id=new_project.id,
                task_type='PPT_RENOVATION',
                status='PENDING',
            )
            ren_task.set_progress({'current': 0, 'total': 0, 'percentage': 0})
            db.session.add(ren_task)
            db.session.commit()
            renovation_task_id = ren_task.id

            ai_service = get_ai_service()
            file_service = FileService()
            file_parser = FileParserService()

            task_manager.submit_task(
                ren_task.id,
                process_ppt_renovation_task,
                new_project.id,
                ai_service,
                file_service,
                file_parser,
                False,   # keep_layout
                5,       # max_workers
                app_obj,
                'zh',
            )
            logger.info(f"[apply] 翻新任务 {ren_task.id} → 项目 {new_project.id}")
        except Exception as e:
            logger.warning(f"[apply] 提交翻新任务失败（项目已创建，可手动触发生成）: {e}")

        return jsonify({
            'code': 200,
            'message': '优化项目已创建，文件处理已开始',
            'data': {
                'project_id': new_project.id,
                'task_id': renovation_task_id,
            }
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"[apply] 应用诊断建议失败: {e}")
        return jsonify({'code': 500, 'message': f'创建优化项目失败: {str(e)}'})
