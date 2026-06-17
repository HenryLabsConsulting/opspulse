# Run the ETL pipeline once at startup to load the warehouse.

FROM python:3.12-slim
WORKDIR /app

COPY etl/requirements.txt ./etl/requirements.txt
RUN pip install --no-cache-dir -r etl/requirements.txt

COPY etl/ ./etl/
COPY data/ ./data/

CMD ["python", "etl/load.py"]
