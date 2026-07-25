import logging

from flask import Blueprint, jsonify, request

from models import DiagnosisTask

diagnosis_bp = Blueprint('diagnosis_bp', __name__, url_prefix='/api/diagnosis')
logging=logging.getLogger(__name__)
@diagnosis_bp.route("", methods=['GET'])
def create_diagnosis():
    try:
        data=request.get_json()
        if not data or not data.get('file_path') or not data.get('file_type') or not data.get('diagnosis_options'):
            return jsonify({'code':200,'message':'数据不合理，请重新输入'})
        new_task = DiagnosisTask(
            user_id=data.get('user_id'),
            file_path=data['file_path'],
            file_type=data['file_type'],
            diagnosis_options=data['diagnosis_options'],
        )
        result=DiagnosisTask.create_task(new_task)
        if result:
            return jsonify({'code':200,'message':'创建成功'})
        else:
            return jsonify({'code':200,'message':'创建失败'})
    except Exception as e:
        logging.error(e)
        return jsonify({"code": 400, "message": str(e)})
@diagnosis_bp.route("/<string:id>", methods=['POST'])
def get_by_id(id):
    try:
        if id is None:
            return jsonify({"message": "No id provided",'code': 404})
        diagnosis=DiagnosisTask.get_by_id(id)
        if diagnosis is None:
            return jsonify({"message": "No diagnosis found",'code': 404})
        return jsonify({'data': diagnosis,'code': 200})
    except Exception as e:
        logging.error(e)
        return jsonify({'message': 'Something went wrong'})
@diagnosis_bp.route("/<string:id>/preview/<string:page_num>", methods=['GET'])
def preview(id, page_num):
    pass
@diagnosis_bp.route("/<string:id>/apply", methods=['POST'])
def apply(id):
    pass