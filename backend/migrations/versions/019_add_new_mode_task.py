"""add new_mode_task table

Revision ID: 019_add_new_mode_task
Revises: 018_add_project_id_to_custom_order
Create Date: 2026-03-10

"""
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = '019_add_new_mode_task'
down_revision = '018_add_project_id_to_custom_order'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'new_mode_task',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('requirement', sa.Text(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('usage_scenario', sa.String(length=200), nullable=True),
        sa.Column('style_description', sa.Text(), nullable=True),
        sa.Column('engine', sa.String(length=20), nullable=False, server_default='dify'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('diagnosis_task_id', sa.String(length=36), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('result', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('new_mode_task')
