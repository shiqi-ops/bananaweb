"""
Order service - business logic for custom orders.

Includes the auto-generation flow: once an order is paid, a PPT project is
created from the order requirement and images are generated in the background.
"""
import logging

from flask import current_app

from models import CustomOrder, Project, UserTemplate, db
from services.project_generation import (
    generate_pages_from_description,
    submit_image_generation,
)

logger = logging.getLogger(__name__)

# 无风格选择时的兜底风格描述（图片生成要求必须有风格描述或模板图）
DEFAULT_TEMPLATE_STYLE = '现代简洁商务风格，配色专业清晰，排版干净大方，图文比例协调。'


def _style_id_to_text(style_id):
    """Map an order's style_id (a UserTemplate id) to a style description text."""
    if not style_id:
        return None
    template = UserTemplate.query.get(style_id)
    if template:
        return template.description or template.name
    return None


def generate_ppt_for_order(task_id, order_id, app):
    """
    Background task: auto-generate a PPT project for a paid order.

    Note: runs in a background thread via TaskManager.submit_task, so it must
    accept task_id as its first argument and receive the Flask app to establish
    an app context inside the thread.
    """
    with app.app_context():
        try:
            order = CustomOrder.query.get(order_id)
            if not order:
                logger.error(f"generate_ppt_for_order: order {order_id} not found")
                return

            # 幂等：已有项目则跳过，避免重复生成
            if order.project_id:
                logger.info(f"order {order_id} already has project {order.project_id}, skip")
                return

            style_text = _style_id_to_text(order.style_id) or DEFAULT_TEMPLATE_STYLE

            project = Project(
                creation_type='descriptions',
                description_text=order.requirement,
                template_style=style_text,
            )
            db.session.add(project)
            db.session.commit()

            order.project_id = project.id
            db.session.commit()

            language = current_app.config.get('OUTPUT_LANGUAGE', 'zh')

            # 1) 解析需求 -> 大纲 + 每页描述
            generate_pages_from_description(project.id, order.requirement, language=language)

            # 2) 提交图片生成（后台任务）
            submit_image_generation(project.id, app=app)

            logger.info(f"order {order_id} -> project {project.id} generation started")
        except Exception as e:
            db.session.rollback()
            logger.error(f"generate_ppt_for_order failed for order {order_id}: {e}", exc_info=True)
