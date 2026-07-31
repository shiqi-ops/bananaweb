from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
import logging
from models import Mentor, db, MentorSlot
from utils import error_response
mentor_bp = Blueprint('mentors', __name__, url_prefix='/api/mentors')
logger = logging.getLogger(__name__)
@mentor_bp.route("", methods=['GET'])
def get_all():
    try:
        mentors = Mentor.get_all()
        mentor_data=[mentor.to_dict() for mentor in mentors]
        return jsonify({
            "code": 200,
            "message": "success",
            "data": mentor_data
        }), 200
    except Exception as e:
        logger.error(e)
        return error_response('有bug', str(e), 500)
@mentor_bp.route("/<string:id>", methods=['GET'])
def get_by_id(id):
    try:
        mentor = Mentor.get_by_id(id)
        if mentor is None:
            return jsonify({"code": 404, "message": "mentor not found"})
        mentor_data=mentor.to_dict()
        return jsonify({
            "code": 200,
            "message": "success",
            "data": mentor_data
        })
    except Exception as e:
        logger.error(e)
        return error_response('查询逻辑有问题', str(e), 500)
@mentor_bp.route("/<string:id>/slots", methods=['GET'])
def get_by_slot_id(id):
    try:
        slot_time=request.args.get('date')
        slot_time=datetime.strptime(slot_time, "%Y-%m-%d %H:%M:%S")
        mentor_slot = MentorSlot.get_slot_by_mentor_id(id)
        if mentor_slot is None:
            return jsonify({"code": 200, "message": "mentor slot not found"})
        if all(
                slot_time > slot.end_time or slot_time < slot.start_time or slot.is_booked is True
                for slot in mentor_slot
        ):
            return jsonify({"code": 200, "message": "mentor slot is not available"})
        return jsonify({'code': 200, 'message':'可以预约'})
    except Exception as e:
        logger.error(e)
        return jsonify({"code": 404, "message": "mentor not found"})