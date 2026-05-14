import psycopg2

try:
    conn = psycopg2.connect(
        host="healthcare-db.ci5mg04u4s12.us-east-1.rds.amazonaws.com",
        port=5432,
        database="postgres",
        user="postgres",
        password="HealthCare2026",
        sslmode="require"
    )

    print("✅ Connection successful!")

    conn.close()

except Exception as e:
    print("❌ Connection failed:")
    print(e)