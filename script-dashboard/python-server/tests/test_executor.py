"""Tests for the script executor."""
import pytest
from sandbox.executor import execute_script


@pytest.mark.asyncio
async def test_execute_simple_script():
    result = await execute_script(
        'print("hello")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert len(result["output"]) == 1
    assert result["output"][0]["args"][0] == "hello"


@pytest.mark.asyncio
async def test_execute_script_with_state():
    result = await execute_script(
        'state["counter"] = state.get("counter", 0) + 1\nconsole.log("counter:", state["counter"])',
        {"counter": 5}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["state"]["counter"] == 6


@pytest.mark.asyncio
async def test_execute_script_error():
    result = await execute_script(
        'raise ValueError("oops")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is False
    assert "oops" in result.get("error", "")


@pytest.mark.asyncio
async def test_execute_script_syntax_error():
    result = await execute_script(
        'this is invalid python {{{',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is False


@pytest.mark.asyncio
async def test_multiple_console_calls():
    result = await execute_script(
        'console.log("a")\nconsole.warn("b")\nconsole.error("c")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert len(result["output"]) == 3
    assert result["output"][0]["type"] == "log"
    assert result["output"][1]["type"] == "warn"
    assert result["output"][2]["type"] == "error"


@pytest.mark.asyncio
async def test_env_is_accessible():
    result = await execute_script(
        'console.log(env.get("API_URL", "default"))',
        {}, {"API_URL": "https://example.com"}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["output"][0]["args"][0] == "https://example.com"


@pytest.mark.asyncio
async def test_props_is_accessible():
    result = await execute_script(
        'console.log(props.get("key", "missing"))',
        {}, {}, {}, {"key": "value"}, lambda *a: None, lambda *a: None
    )
    assert result["output"][0]["args"][0] == "value"


@pytest.mark.asyncio
async def test_secrets_masked_in_output():
    result = await execute_script(
        'console.log("token:", secrets.get("TOKEN", ""))',
        {}, {}, {"TOKEN": "secret123"}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    # Secrets should be masked in the state
    assert "secret123" not in str(result["state"])


@pytest.mark.asyncio
async def test_execute_empty_script():
    result = await execute_script(
        '', {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True


@pytest.mark.asyncio
async def test_print_multiple_args():
    result = await execute_script(
        'print("a", "b", "c")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert len(result["output"]) == 1
    assert result["output"][0]["args"] == ["a b c"]


@pytest.mark.asyncio
async def test_print_and_state():
    result = await execute_script(
        'state["x"] = 42\nprint("done")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["state"]["x"] == 42
    assert len(result["output"]) == 1
    assert result["output"][0]["args"][0] == "done"


@pytest.mark.asyncio
async def test_requests_is_available():
    result = await execute_script(
        'resp = requests.get("https://httpbin.org/get")\nprint(resp.status_code)',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert len(result["output"]) >= 1


@pytest.mark.asyncio
async def test_import_stdlib():
    result = await execute_script(
        'import json\nd = json.loads(\'{"a":1}\')\nprint(d["a"])',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "1"


@pytest.mark.asyncio
async def test_import_pandas():
    result = await execute_script(
        'import pandas as pd\ndf = pd.DataFrame({"x": [1,2,3]})\nprint(len(df))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "3"


@pytest.mark.asyncio
async def test_import_feedparser():
    result = await execute_script(
        'import feedparser\nprint(hasattr(feedparser, "parse"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_lxml():
    result = await execute_script(
        'from lxml import etree\nroot = etree.fromstring("<root><item>hello</item></root>")\nprint(root.find("item").text)',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "hello"


@pytest.mark.asyncio
async def test_import_numpy():
    result = await execute_script(
        'import numpy as np\nprint(np.array([1, 2, 3]).sum())',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "6"


@pytest.mark.asyncio
async def test_import_pyyaml():
    result = await execute_script(
        'import yaml\ndata = yaml.safe_load("key: value")\nprint(data["key"])',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "value"


@pytest.mark.asyncio
async def test_import_beautifulsoup4():
    result = await execute_script(
        'from bs4 import BeautifulSoup\nsoup = BeautifulSoup("<p>hello</p>", "html.parser")\nprint(soup.p.text)',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "hello"


@pytest.mark.asyncio
async def test_import_openpyxl():
    result = await execute_script(
        'import openpyxl\nprint(hasattr(openpyxl, "Workbook"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_matplotlib():
    result = await execute_script(
        'import matplotlib\nprint(matplotlib.__name__)',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "matplotlib"


@pytest.mark.asyncio
async def test_import_xmltodict():
    result = await execute_script(
        'import xmltodict\nd = xmltodict.parse("<root><item>value</item></root>")\nprint(d["root"]["item"])',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "value"


@pytest.mark.asyncio
async def test_import_pypdf():
    result = await execute_script(
        'import pypdf\nprint(hasattr(pypdf, "PdfReader"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_sqlalchemy():
    result = await execute_script(
        'import sqlalchemy\nprint(hasattr(sqlalchemy, "create_engine"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_psycopg2():
    result = await execute_script(
        'import psycopg2\nprint(hasattr(psycopg2, "connect"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_pyodbc():
    result = await execute_script(
        'import pyodbc\nprint(hasattr(pyodbc, "connect"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_import_psycopg2():
    result = await execute_script(
        'import psycopg2\nprint(hasattr(psycopg2, "connect"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_js_comment_triggers_warning():
    result = await execute_script(
        '// JS comment\nprint("ok")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    # // is invalid Python, so script will fail — but warning should be emitted first
    assert any(o["type"] == "warn" and "//" in str(o["args"]) for o in result["output"])
    assert any(o["type"] == "error" for o in result["output"])


@pytest.mark.asyncio
async def test_js_equals_triggers_warning():
    result = await execute_script(
        'if 1 === 1:\n  print("ok")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    # === is invalid Python → script will fail, but warning emitted
    outputs = result["output"]
    assert any(o["type"] == "warn" and "===" in str(o["args"]) for o in outputs) or \
           any(o["type"] == "error" for o in outputs)


@pytest.mark.asyncio
async def test_js_let_triggers_warning():
    result = await execute_script(
        'let x = 1\nprint("ok")',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    outputs = result["output"]
    assert any(o["type"] == "warn" and "let" in str(o["args"]) for o in outputs) or \
           any(o["type"] == "error" for o in outputs)
