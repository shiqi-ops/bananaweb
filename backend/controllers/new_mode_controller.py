"""
New Mode controller — 新模式（Dify 生成）API

接口:
    POST /api/new-mode                     创建生成任务
    GET  /api/new-mode                     最近任务列表
    GET  /api/new-mode/<id>                任务详情 / 进度
    GET  /api/new-mode/<id>/download       下载生成的 PPTX
"""
import logging
import os
import uuid

from flask import Blueprint, jsonify, request, send_file, current_app

from models import db, NewModeTask

new_mode_bp = Blueprint('new_mode_bp', __name__, url_prefix='/api/new-mode')
logger = logging.getLogger(__name__)

DEFAULT_PAGE_COUNT = 10
MAX_PAGE_COUNT = 60


@new_mode_bp.route("", methods=['POST'])
def create_task():
    try:
        data = request.get_json() or {}
        requirement = (data.get('requirement') or '').strip()
        if not requirement:
            return jsonify({'code': 400, 'message': '需求描述不能为空'})

        try:
            page_count = int(data.get('page_count') or DEFAULT_PAGE_COUNT)
        except (TypeError, ValueError):
            page_count = DEFAULT_PAGE_COUNT
        page_count = max(1, min(page_count, MAX_PAGE_COUNT))

        title = (data.get('title') or '').strip() or None

        task = NewModeTask(
            id=str(uuid.uuid4()),
            user_id=(data.get('user_id') or '').strip() or None,
            requirement=requirement,
            title=title,
            page_count=page_count,
            usage_scenario=(data.get('usage_scenario') or '').strip() or None,
            style_description=(data.get('style_description') or '').strip() or None,
            status='PENDING',
            note='任务已创建，等待开始...',
        )
        success = NewModeTask.create_task(task)
        if not success:
            return jsonify({'code': 500, 'message': '创建失败，数据库写入错误'})

        app = current_app._get_current_object()
        from services.task_manager import task_manager
        from services.new_mode_service import run_new_mode_task
        task_manager.submit_task(task.id, run_new_mode_task, app)

        return jsonify({
            'code': 200,
            'message': '创建成功',
            'data': {'task_id': task.id, 'status': task.status},
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建新模式任务失败: {e}")
        return jsonify({'code': 500, 'message': f'创建失败: {str(e)}'})


@new_mode_bp.route("/enrich", methods=['POST'])
def enrich():
    """通用：把一条指令/描述先经 Dify 加工（供素材生成、单页生图等"新模式"使用）。"""
    try:
        data = request.get_json() or {}
        instruction = (data.get('instruction') or data.get('requirement') or '').strip()
        if not instruction:
            return jsonify({'code': 400, 'message': 'instruction 不能为空'})

        from services.dify_service import is_dify_configured, enrich_with_dify
        if not is_dify_configured():
            return jsonify({
                'code': 200,
                'message': 'Dify 未配置，返回原文（传统模式回退）',
                'data': {'text': '', 'enriched': False},
            })
        text = enrich_with_dify(
            instruction=instruction,
            title=(data.get('title') or '').strip(),
            style=(data.get('style') or data.get('style_description') or '').strip(),
            usage_scenario=(data.get('usage_scenario') or '').strip(),
            page_count=int(data.get('page_count') or 1),
        )
        return jsonify({
            'code': 200,
            'message': 'success',
            'data': {'text': text, 'enriched': bool(text)},
        })
    except Exception as e:
        logger.error(f"新模式 enrich 失败: {e}")
        return jsonify({'code': 500, 'message': f'Dify 精修失败: {str(e)}'})


@new_mode_bp.route("", methods=['GET'])
def list_tasks():
    try:
        user_id = (request.args.get('user_id') or '').strip() or None
        limit = 30
        query = NewModeTask.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        tasks = query.order_by(NewModeTask.created_at.desc()).limit(limit).all()
        return jsonify({
            'code': 200,
            'message': 'success',
            'data': {'items': [t.to_dict() for t in tasks]},
        })
    except Exception as e:
        logger.error(f"查询新模式任务列表失败: {e}")
        return jsonify({'code': 500, 'message': '查询失败'})


@new_mode_bp.route("/<string:task_id>", methods=['GET'])
def get_task(task_id):
    try:
        task = NewModeTask.get_by_id(task_id)
        if task is None:
            return jsonify({'code': 404, 'message': '任务不存在'})
        return jsonify({'code': 200, 'message': 'success', 'data': task.to_dict()})
    except Exception as e:
        logger.error(f"查询新模式任务失败: {e}")
        return jsonify({'code': 500, 'message': '查询失败'})


@new_mode_bp.route("/<string:task_id>/download", methods=['GET'])
def download(task_id):
    try:
        task = NewModeTask.get_by_id(task_id)
        if task is None:
            return jsonify({'code': 404, 'message': '任务不存在'})
        if task.status not in ('COMPLETED',):
            return jsonify({'code': 400, 'message': f'任务尚未完成，当前状态: {task.status}'})
        if not task.file_path or not os.path.exists(task.file_path):
            return jsonify({'code': 500, 'message': 'PPTX 文件不存在或已被清理'})
        return send_file(
            task.file_path,
            as_attachment=True,
            download_name=task.file_name or f'{task.id}.pptx',
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation',
        )
    except Exception as e:
        logger.error(f"下载新模式 PPTX 失败: {e}")
        return jsonify({'code': 500, 'message': f'下载失败: {str(e)}'})
