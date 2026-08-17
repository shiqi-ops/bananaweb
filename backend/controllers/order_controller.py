from datetime import datetime
import json

from flask import Blueprint, request,jsonify
import logging
from models import CustomOrder, db, Mentor

order_bp = Blueprint('order', __name__,url_prefix='/api/orders')
logging=logging.getLogger(__name__)
def datatime_deal(raw_time: str):
    if not raw_time:
        return None
    formats = (
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M',
    )
    for fmt in formats:
        try:
            return datetime.strptime(raw_time, fmt)
        except ValueError:
            continue
    logging.error(f"无法解析交付时间: {raw_time}")
    return None

def _serialize_reference_files(reference_files):
    if reference_files is None:
        return None
    if isinstance(reference_files, str):
        return reference_files
    return json.dumps(reference_files, ensure_ascii=False)
@order_bp.route("", methods=['POST'])
def create_order():
    try:
        data=request.get_json()
        if not data or not data.get('contact_name') or not data.get('requirement'):
            return jsonify({"code": 400, "message": "联系人姓名和需求描述为必填项"})
        new_order = CustomOrder(
            user_id=data.get('user_id'),
            contact_name=data['contact_name'],
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email'),
            requirement=data['requirement'],
            page_count=data.get('page_count'),
            usage_scenario=data.get('usage_scenario'),
            style_id=data.get('style_id'),
            mentor_id=data.get('mentor_id'),
            deadline=datatime_deal(data.get('deadline')),
            price=data.get('price'),
            reference_files=_serialize_reference_files(data.get('reference_files')),
        )
        result=CustomOrder.create_order(new_order)
        if result:
            return jsonify({"code": 200, "message": "success",'data':new_order.id})
        else:
            return jsonify({"code":400,'message':'创建失败，请重新尝试'})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("", methods=['GET'])
def list_orders():
    try:
        user_id = request.args.get('user_id')
        if user_id:
            orders = CustomOrder.query.filter_by(user_id=user_id).order_by(CustomOrder.created_at.desc()).all()
        else:
            orders = CustomOrder.query.order_by(CustomOrder.created_at.desc()).all()
        return jsonify({'code': 200, 'message': 'success', 'data': [o.to_dict() for o in orders]})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("/<string:id>", methods=['GET'])
def get_by_id(id):
    try:
        data=CustomOrder.get_by_id(id)
        if not data:
            return jsonify({'code':200,'message':'没有找到，请重新输入'})
        return jsonify({'code':200,'data':data.to_dict()})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("/<string:id>", methods=['PUT'])
def update_order(id):
    try:
        data=request.get_json()
        if not data or not data.get('id'):
            return jsonify({'code':200,'message':'数据或者id不能为空，请重新输入'})
        new_order = CustomOrder(
            id=data['id'],
            user_id=data.get('user_id'),
            contact_name=data.get('contact_name'),
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email'),
            requirement=data.get('requirement'),
            page_count=data.get('page_count'),
            usage_scenario=data.get('usage_scenario'),
            style_id=data.get('style_id'),
            mentor_id=data.get('mentor_id'),
            deadline=datatime_deal(data.get('deadline')),
            price=data.get('price'),
            reference_files=_serialize_reference_files(data.get('reference_files')),
        )
        result=CustomOrder.update_by_id(new_order)
        if result:
            return jsonify({"code": 200, "message": "success"})
        else:
            return jsonify({'code':200,'message':'修改失败，请重新尝试'})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("/<string:id>", methods=['DELETE'])
def delete_order(id):
    try:
        if id is None:
            return jsonify({'code':200,'message':'id不可以为空'})
        result = CustomOrder.delete_by_id(id)
        if result:
            return jsonify({"code": 200, "message": "success"})
        else:
            return jsonify({'code':200,'message':'修改失败，请重新尝试'})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("/prices", methods=['POST'])
def compute_price():
    try:
        data=request.get_json()
        page_count=data.get('page_count',1)
        base_price=page_count*50
        if data.get('style_id'):
            base_price=base_price*1.2
        if data.get('mentor_id'):
            mentor=Mentor.query.filter_by(id=data.get('mentor_id')).first()
            if mentor:
                base_price+=mentor.price_per_hour*0.5*page_count
        return jsonify({'code':200,'message':'success','data':base_price})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@order_bp.route("/<string:id>/pay", methods=['POST'])
def pay_order(id):
    order=CustomOrder.get_by_id(id)
    if not order:
        return jsonify({'code':400,'message':'订单不存在'})
    if order.payment_status=='PAID':
        return jsonify({'code':200,'message':'已支付，无需重复支付'})
    order.payment_status='PAID'
    order.status = 'PAID'
    db.session.commit()
    return jsonify({'code': 200, 'message': 'success'})
@order_bp.route("/<string:id>/pay_status", methods=['GET'])
@order_bp.route("/<string:id>/payment-status", methods=['GET'])
def pay_status(id):
    try:
        if id is None:
            return jsonify({'code':200,'message':'id不可以为空'})
        result = CustomOrder.get_pay_status_by_id(id)
        if result:
            return jsonify({"code": 200, "message": "success",'data':result})
        else:
            return jsonify({'code':200,'message':'没有查到'})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
