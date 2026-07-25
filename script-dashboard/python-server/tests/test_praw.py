"""Tests for praw support in the sandbox."""
import pytest
from sandbox.executor import execute_script


@pytest.mark.asyncio
async def test_import_praw():
    result = await execute_script(
        'import praw\nprint(hasattr(praw, "Reddit"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"


@pytest.mark.asyncio
async def test_praw_reddit_class_has_required_methods():
    result = await execute_script(
        'import praw\nr = praw.Reddit(client_id="", client_secret="", user_agent="")\nprint(hasattr(r, "read_only"))',
        {}, {}, {}, {}, lambda *a: None, lambda *a: None
    )
    assert result["success"] is True
    assert result["output"][0]["args"][0] == "True"
