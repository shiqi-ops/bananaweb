from datetime import datetime

from flask import Blueprint, request, jsonify
import logging

from models import MentorSession, db
from utils.path_utils import logger

session_bp = Blueprint('session', __name__, url_prefix='/api/sessions')
logging=logging.getLogger(__name__)
def datatime_deal(raw_time:str):
    try:
        return datetime.strptime(raw_time, '%Y-%m-%d %H:%M:%S')
    except Exception as e:
        logging.error(e)
        return None
@session_bp.route('', methods=['POST'])
def create_session():
    try:
        data=request.get_json()
        if not data or not data.get('contact_name') or not data.get('duration_minutes') or not data.get('scheduled_start') or not data.get('scheduled_end') or not data.get('price') or not data.get('mentor_id'):
            return jsonify({'code':200,'message':'数据不合理'})

        new_session=MentorSession(
            user_id=data.get('user_id'),
            contact_name=data['contact_name'],
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email'),
            duration_minutes=data['duration_minutes'],
            scheduled_start=datatime_deal(data['scheduled_start']),
            scheduled_end=datatime_deal(data['scheduled_end']),
            mentor_id=data['mentor_id'],
            price=data['price'],
            notes=data.get('notes')
        )
        result=MentorSession.create_session(new_session)
        if result:
            return jsonify({'code':200,'message':'success','data':new_session.id})
        else:
            return jsonify({'code':200,'message':'failed'})
    except Exception as e:
        logger.error(e)
        return jsonify({'code': 400, 'message': '错误，请重新尝试'})
@session_bp.route('/<string:id>', methods=['GET'])
def get_by_id(id):
    try:
        if not id:
            return jsonify({'code':200,'message':'id不可以为空'})
        result =MentorSession.get_sessions_by_id(id)
        if result:
            return jsonify({'code':200,'message':'success','data':result.to_dict()})
        else:
            return jsonify({'code':200,'message':'failed'})
    except Exception as e:
        logger.error(e)
        return jsonify({'code':400,'message':'查询失败，请重新尝试'})
@session_bp.route('/<string:id>', methods=['PUT'])
def update_session(id):
    try:
        data=request.get_json()
        if not data or not id:
            return jsonify({'code':200,'message':'数据不合理'})
        new_session=MentorSession(
            id=id,
            user_id=data.get('user_id'),
            contact_name=data['contact_name'],
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email'),
            duration_minutes=data['duration_minutes'],
            scheduled_start=datatime_deal(data['scheduled_start']),
            scheduled_end=datatime_deal(data['scheduled_end']),
            price=data['price'],
            notes=data.get('notes'),
            status=data.get('status'),
            payment_status=data.get('payment_status'),
            mentor_id=data.get('mentor_id'),
        )
        result=MentorSession.update_session_by_id(new_session.to_dict())
        if result:
            return jsonify({'code':200,'message':'success'})
        else:
            return jsonify({'code':200,'message':'failed'})
    except Exception as e:
        logger.error(e)
        return jsonify({'code': 400, 'message': '查询失败，请重新尝试'})
@session_bp.route('/<string:id>', methods=['DELETE'])
def delete_session(id):
    try:
        if not id:
            return jsonify({'code': 200, 'message': 'id不可以为空'})
        result = MentorSession.delete_session_by_id(id)
        if result:
            return jsonify({'code':200,'message':'success'})
        else:
            return jsonify({'code':200,'message':'failed'})
    except Exception as e:
        logger.error(e)
        return jsonify({'code':400,'message':'查询失败，请重新尝试'})
@session_bp.route('/<string:id>/pay', methods=['POST'])
def pay_session(id):
    session=MentorSession.get_session_by_id(id)
    if not session:
        return jsonify({'code':400,'message':'预约不存在'})
    if session.payment_status == 'PAID':
        return jsonify({"code": 200, "message": "已支付"})
    session.payment_status = 'PAID'
    session.status = 'CONFIRMED'
    db.session.commit()
    return jsonify({'code':200,'message':'success'})
@session_bp.route('/<string:id>/pay_status', methods=['GET'])
def pay_status(id):
    try:
        if not id:
            return jsonify({'code':200,'message':'id不可以为空'})
        result = MentorSession.get_payment_status(id)
        if result:
            return jsonify({'code':200,'message':'success','data':result})
        else:
            return jsonify({'code':200,'message':'failed'})
    except Exception as e:
        logger.error(e)
        return jsonify({'code':400,'message':'网络错误，请重新尝试'})
