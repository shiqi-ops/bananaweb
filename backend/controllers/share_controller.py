import base64
import io
import logging
import os
import uuid
import qrcode
from flask import Blueprint, request,jsonify
from models import InviteRecord, db, Reward
from PIL import Image, ImageDraw, ImageFont
share_bp = Blueprint('share_bp', __name__,url_prefix='/api/share')
logger=logging.getLogger(__name__)
@share_bp.route('/invite-link',methods=['GET'])
def invite_link():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'code': 400, 'message': 'user_id不可以为空'})
        existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
        if existing:
            invite_code = existing.invite_code
        else:
            invite_code = uuid.uuid4().hex[:8]
            record = InviteRecord(
                inviter_user_id=user_id,
                invite_code=invite_code,
                status='PENDING'
            )
            db.session.add(record)
            db.session.commit()
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        invite_link = f"{frontend_url}/register?invite_code={invite_code}"
        return jsonify({'code': 200, 'message': 'success', 'data': {
            'invite_code': invite_code,
            'invite_link': invite_link
        }})
    except Exception as e:
        logger.error(e)
        return jsonify({'code':400,'message':f'{e}'})
@share_bp.route('/qrcode',methods=['GET'])
def generate_qrcode():
    user_id=request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
    if existing:
        invite_code = existing.invite_code
    else:
        invite_code = uuid.uuid4().hex[:8]
        record = InviteRecord(
            inviter_user_id=user_id,
            invite_code=invite_code,
            status='PENDING'
        )
        db.session.add(record)
        db.session.commit()
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    invite_link = f"{frontend_url}/register?invite_code={invite_code}"

    img = qrcode.make(invite_link)
    buf=io.BytesIO()
    img.save(buf,format='png')
    buf.seek(0)
    return jsonify({'code': 200, 'message': 'success', 'data': {
        'qrcode_base64': base64.b64encode(buf.read()).decode('utf-8')
    }})
@share_bp.route('/poster',methods=['POST'])
def poster():
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    invite_link=_get_or_create_invite_link(user_id)
    qr_img = qrcode.make(invite_link).convert('RGB').resize((300,300))

    bg = Image.new('RGB', (750, 1334), color=(255, 255, 255))
    bg.paste(qr_img,(275,900))

    buf = io.BytesIO()
    bg.save(buf,format='png')
    buf.seek(0)
    return jsonify({'code': 200, 'message': 'success', 'data': {
        'poster_base64': base64.b64encode(buf.read()).decode('utf-8')
    }})
@share_bp.route('/invitees',methods=['GET'])
def invitees():
    user_id=request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    invitees = InviteRecord.get_by_inviter(user_id)
    result=[i.to_dict() for i in invitees]
    return jsonify({'code': 200, 'data': result,'message': 'success'})
@share_bp.route('/rewards',methods=['GET'])
def rewards():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    rewards = Reward.get_by_user_id(user_id)
    if not rewards:
        return jsonify({'code': 200, 'message': "没有查到"})
    result = [r.to_dict() for r in rewards]
    return jsonify({'code': 200, 'message': 'success', 'data': result})
@share_bp.route('rewards/<string:id>/claim',methods=['POST'])
def claim(id):
    data = request.get_json()
    user_id = data.get('user_id')

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'code': 400, 'message': '奖励不存在'})
    if reward.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权领取'})
    if reward.is_claimed:
        return jsonify({'code': 200, 'message': '已领取，无需重复领取'})
    reward.is_claimed = True
    db.session.commit()

    return jsonify({'code': 200,'message':'已领取'})
def _get_or_create_invite_link(user_id):
    existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
    if existing:
        invite_code = existing.invite_code
    else:
        invite_code = uuid.uuid4().hex[:8]
        record = InviteRecord(
            inviter_user_id=user_id,
            invite_code=invite_code,
            status='PENDING'
        )
        db.session.add(record)
        db.session.commit()
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    invite_link = f"{frontend_url}/register?invite_code={invite_code}"
    return invite_link