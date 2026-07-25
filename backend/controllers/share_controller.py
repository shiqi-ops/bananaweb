from flask import Blueprint
share_bp = Blueprint('share_bp', __name__,url_prefix='/api/share')

@share_bp.route('/invite-link',methods=['GET'])
def invite_link():
    pass
@share_bp.route('/qrcode',methods=['GET'])
def qrcode():
    pass
@share_bp.route('/poster',methods=['POST'])
def poster():
    pass
@share_bp.route('/invitees',methods=['GET'])
def invitees():
    pass
@share_bp.route('/rewards',methods=['GET'])
def rewards():
    pass
@share_bp.route('rewards/<int:id>/claim',methods=['POST'])
def claim():
    pass