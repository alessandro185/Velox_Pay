# VeloxPay - API de Pagamentos

Projeto simples de API com FastAPI e frontend modular estatico para simular uma interface de pagamentos.

## Tecnologias

- Python
- FastAPI
- Uvicorn
- HTML, CSS e JavaScript

## Estrutura do projeto

```text
.
|-- main.py
|-- requirements.txt
|-- static/
|   `-- index.html
|-- trabalhoAPI1/
|   |-- entrega_1.py
|   |-- entrega_2.py
|   `-- entrega_3.py
`-- veloxpay-frontend/
    |-- index.html
    |-- css/
    |-- js/
    `-- views/
```

## Como executar

### 1. Criar e ativar o ambiente virtual

No Windows com PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar as dependencias

```powershell
pip install -r requirements.txt
```

### 3. Iniciar o servidor

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Tambem e possivel executar diretamente:

```powershell
python main.py
```

## Acessos

- Frontend: `http://127.0.0.1:8000`
- Documentacao Swagger: `http://127.0.0.1:8000/docs`
- Documentacao ReDoc: `http://127.0.0.1:8000/redoc`

## Endpoints principais

### `GET /`

Retorna o frontend principal do VeloxPay.

### `GET /status`

Retorna o status da API.

Exemplo de resposta:

```json
{
  "status": "ativo",
  "api": "funcionando",
  "app": "VeloxPay"
}
```

### `GET /items/{item_id}`

Endpoint de exemplo que recebe um ID numerico e um parametro opcional `q`.

Exemplo:

```text
http://127.0.0.1:8000/items/10?q=teste
```

Resposta:

```json
{
  "item_id": 10,
  "query": "teste"
}
```

## Observacoes para o Git

Nao envie ambientes virtuais, caches ou logs para o repositorio. Recomenda-se manter arquivos como estes no `.gitignore`:

```gitignore
.venv/
.venv-1/
.venv313/
__pycache__/
*.pyc
*.log
```

## Autor

Projeto desenvolvido como trabalho/API de pagamentos com FastAPI.
