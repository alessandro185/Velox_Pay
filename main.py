from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="VeloxPay - API de Pagamentos",
    description="API simples com frontend modular para pagamentos.",
    version="1.0.0",
)

app.mount("/css", StaticFiles(directory="veloxpay-frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="veloxpay-frontend/js"), name="js")
app.mount("/views", StaticFiles(directory="veloxpay-frontend/views"), name="views")


@app.get("/")
async def root():
    return FileResponse("veloxpay-frontend/index.html")


@app.get("/status")
async def status():
    return {"status": "ativo", "api": "funcionando", "app": "VeloxPay"}


@app.get("/items/{item_id}")
async def get_item(item_id: int, q: str = None):
    return {"item_id": item_id, "query": q}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
