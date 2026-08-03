"""直接操作用SQLite插入测试数据"""
import sqlite3
import uuid
from datetime import datetime, timedelta

DB_PATH = r"D:\code\bananaweb\backend\instance\database.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def uid():
    return str(uuid.uuid4())

# ---- 1. 风格 (user_templates) ----
for name, desc in [
    ("简约商务", "简洁大气的商务风格，适合企业汇报和商业计划书"),
    ("科技感", "炫酷的科技风格，适合产品发布和技术路演"),
    ("学术答辩", "规范严谨的学术风格，适合毕业答辩和论文汇报"),
    ("创意手绘", "活泼创意的插画风格，适合教育培训和团队分享"),
    ("中国风", "典雅大气的国风设计，适合文化展示和传统主题"),
]:
    cur.execute(
        "INSERT INTO user_templates (id, name, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (uid(), desc, "/dev/null", now, now)
    )
print("插入 5 个风格")

# ---- 2. 导师 ----
mentor_ids = []
for name, title, specialty, desc, price in [
    ("张伟", "资深PPT设计师", "商务演示、产品发布", "10年PPT设计经验，曾为多家500强企业提供演示设计服务", 200),
    ("李娜", "视觉设计专家", "创意设计、品牌视觉", "毕业于中央美术学院，擅长将复杂信息转化为直观视觉表达", 300),
    ("王强", "数据可视化顾问", "数据图表、分析报告", "前麦肯锡数据分析师，精通数据故事讲述与可视化呈现", 250),
    ("陈雪", "教育培训讲师", "教学课件、培训材料", "知名在线教育平台签约讲师，累计制作2000+教学PPT", 180),
]:
    mid = uid()
    mentor_ids.append(mid)
    cur.execute(
        "INSERT INTO mentor (id, name, title, specialty, description, price_per_hour, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (mid, name, title, specialty, desc, price, 1, 0, now, now)
    )
print(f"插入 {len(mentor_ids)} 个导师")

# ---- 3. 导师时间段（未来7天） ----
slot_count = 0
base = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
for mid in mentor_ids:
    for day_offset in range(1, 8):
        day = base + timedelta(days=day_offset)
        for hour in [9, 14]:
            start = day.replace(hour=hour).strftime("%Y-%m-%d %H:%M:%S")
            end = day.replace(hour=hour + 1).strftime("%Y-%m-%d %H:%M:%S")
            cur.execute(
                "INSERT INTO mentor_slot (id, mentor_id, start_time, end_time, is_booked, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (uid(), mid, start, end, 0, now)
            )
            slot_count += 1
print(f"插入 {slot_count} 个时间段")

# ---- 4. 邀请记录 ----
for name, status in [
    ("张三", "REGISTERED"),
    ("李四", "REGISTERED"),
    ("王五", "PENDING"),
    ("赵六", "REWARDED"),
]:
    reg_at = (base - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S") if status in ("REGISTERED", "REWARDED") else None
    seven_days_ago = (base - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "INSERT INTO invite_records (id, inviter_user_id, invitee_user_id, invite_code, status, reward_granted, created_at, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (uid(), "user-001", uid() if status != "PENDING" else None, str(uuid.uuid4())[:8], status, status == "REWARDED", seven_days_ago, reg_at)
    )
print("插入 4 条邀请记录")

# ---- 5. 奖励 ----
for rtype, amount, desc, claimed in [
    ("CREDITS", 100, "邀请好友注册奖励积分", 0),
    ("FREE_ORDER", 1, "邀请满3人赠送一次免费定制", 0),
    ("DISCOUNT", 50, "新用户注册50元代金券", 1),
]:
    cur.execute(
        "INSERT INTO reward (id, user_id, reward_type, amount, description, is_claimed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (uid(), "user-001", rtype, amount, desc, claimed, now)
    )
print("插入 3 条奖励记录")

conn.commit()
conn.close()
print("全部数据插入完成！")
