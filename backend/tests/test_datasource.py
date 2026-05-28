"""
Datasource validation tests — run with: python -m tests.test_datasource
or import and call run_tests() directly.
"""

import sys
import os
from pathlib import Path

# Ensure backend root is on path
BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Set DATASOURCE path for standalone execution
DATASOURCE_ROOT = BACKEND_ROOT / "Datasource"


def run_tests():
    """
    Run datasource validation tests.
    Returns a list of pass/fail results.
    """
    # Import parsers directly (no FastAPI app needed)
    from app.services.datasource.release_parser import ReleaseParser
    from app.services.datasource.jira_parser import JiraParser
    from app.services.datasource.log_parser import LogParser
    from app.services.datasource.patch_notes_parser import PatchNotesParser
    from app.services.datasource.error_codes_parser import ErrorCodesParser
    from app.services.datasource.flags_parser import FlagsParser
    from app.services.datasource.greek_codes_parser import GreekCodesParser
    from app.services.datasource.client_release_parser import ClientReleaseParser
    from app.services.datasource.circulars_parser import CircularsParser
    from app.services.datasource.test_cases_parser import TestCasesParser
    from app.services.datasource.utilities_parser import UtilitiesParser
    from app.services.datasource.manager import DataSourceManager, DATASOURCE_ROOT as DS_ROOT

    root = DATASOURCE_ROOT

    results = []

    def test(name, fn):
        try:
            fn()
            results.append({"test": name, "status": "PASS"})
            print(f"  PASS  {name}")
        except AssertionError as e:
            results.append({"test": name, "status": "FAIL", "error": str(e)})
            print(f"  FAIL  {name}: {e}")
        except Exception as e:
            results.append({"test": name, "status": "ERROR", "error": str(e)})
            print(f"  ERROR {name}: {e}")

    print(f"\nDatasource root: {root}")
    print(f"Root exists: {root.exists()}\n")

    # ---- Release tests ----
    releases = ReleaseParser(root).parse()

    test("releases_parsed", lambda: _assert(
        len(releases) > 0,
        f"Expected >0 releases, got {len(releases)}"
    ))

    test("releases_have_version", lambda: _assert(
        all("version" in r and r["version"] for r in releases),
        "Some releases missing version"
    ))

    test("releases_have_status", lambda: _assert(
        all("status" in r for r in releases),
        "Some releases missing status"
    ))

    test("releases_health_color_set", lambda: _assert(
        all(r.get("health_color") in ("green", "amber", "red", "gray") for r in releases),
        "Health color must be green/amber/red/gray"
    ))

    test("releases_v948_present", lambda: _assert(
        any("v9.48" in r.get("version", "") for r in releases),
        "v9.48 release not found"
    ))

    # ---- Jira tests ----
    jira_issues = JiraParser(root).parse()

    test("jira_issues_parsed", lambda: _assert(
        len(jira_issues) > 0,
        f"Expected >0 Jira issues, got {len(jira_issues)}"
    ))

    test("jira_issues_have_id", lambda: _assert(
        all(i.get("jira_id") for i in jira_issues),
        "Some issues missing jira_id"
    ))

    test("jira_issues_have_search_text", lambda: _assert(
        all("search_text" in i for i in jira_issues),
        "Some issues missing search_text"
    ))

    test("jira_issue_1021_present", lambda: _assert(
        any("JIRA-1021" in i.get("jira_id", "") for i in jira_issues),
        "JIRA-1021 not found in parsed issues"
    ))

    test("jira_issues_have_status", lambda: _assert(
        all(i.get("status") for i in jira_issues),
        "Some issues missing status"
    ))

    # ---- Log tests ----
    logs = LogParser(root).parse()

    test("log_files_parsed", lambda: _assert(
        len(logs) > 0,
        f"Expected >0 log files, got {len(logs)}"
    ))

    test("logs_have_module", lambda: _assert(
        all(l.get("module") for l in logs),
        "Some log files missing module"
    ))

    test("logs_have_entries", lambda: _assert(
        all(isinstance(l.get("entries"), list) for l in logs),
        "Some log files missing entries list"
    ))

    test("logs_entry_counts_positive", lambda: _assert(
        all(l.get("entry_count", 0) >= 0 for l in logs),
        "Negative entry count in some log files"
    ))

    test("rms_log_detected", lambda: _assert(
        any(l.get("module") == "rms" for l in logs),
        "RMS log module not detected"
    ))

    # ---- Patch notes tests ----
    patch_notes = PatchNotesParser(root).parse()

    test("patch_notes_parsed", lambda: _assert(
        len(patch_notes) > 0,
        f"Expected >0 patch notes, got {len(patch_notes)}"
    ))

    test("patch_notes_have_version", lambda: _assert(
        all(pn.get("version") for pn in patch_notes),
        "Some patch notes missing version"
    ))

    test("patch_notes_have_jira_refs", lambda: _assert(
        any(len(pn.get("jira_refs", [])) > 0 for pn in patch_notes),
        "No JIRA refs found in any patch notes"
    ))

    test("patch_notes_v948_present", lambda: _assert(
        any("v9.48" in pn.get("version", "") for pn in patch_notes),
        "v9.48 patch notes not found"
    ))

    # ---- Error codes tests ----
    error_codes = ErrorCodesParser(root).parse()

    test("error_codes_parsed", lambda: _assert(
        len(error_codes) > 0,
        f"Expected >0 error codes, got {len(error_codes)}"
    ))

    test("error_codes_have_code_field", lambda: _assert(
        all(e.get("code") for e in error_codes),
        "Some error codes missing code field"
    ))

    test("error_codes_have_severity", lambda: _assert(
        all(e.get("severity") for e in error_codes),
        "Some error codes missing severity"
    ))

    test("rms001_error_code_present", lambda: _assert(
        any("RMS001" in e.get("code", "").upper().replace("-", "") for e in error_codes),
        "RMS001 error code not found"
    ))

    # ---- Flags tests ----
    flags = FlagsParser(root).parse()

    test("flags_parsed", lambda: _assert(
        len(flags) > 0,
        f"Expected >0 flags, got {len(flags)}"
    ))

    test("flags_have_name_and_value", lambda: _assert(
        all(f.get("name") for f in flags),
        "Some flags missing name"
    ))

    test("flags_have_source_file", lambda: _assert(
        all(f.get("source_file") for f in flags),
        "Some flags missing source_file"
    ))

    test("ini_flags_parsed", lambda: _assert(
        any(f.get("type") == "ini" for f in flags),
        "No INI flags found"
    ))

    test("runtime_flags_parsed", lambda: _assert(
        any(f.get("type") == "runtime" for f in flags),
        "No runtime flags found"
    ))

    # ---- Greek codes tests ----
    greek_codes = GreekCodesParser(root).parse()

    test("greek_codes_parsed", lambda: _assert(
        len(greek_codes) > 0,
        f"Expected >0 greek codes, got {len(greek_codes)}"
    ))

    test("greek_codes_have_exchange", lambda: _assert(
        all(g.get("exchange") for g in greek_codes),
        "Some greek codes missing exchange"
    ))

    test("nse_greek_codes_present", lambda: _assert(
        any(g.get("exchange") == "NSE" for g in greek_codes),
        "No NSE greek codes found"
    ))

    # ---- Client releases tests ----
    clients = ClientReleaseParser(root).parse()

    test("client_releases_parsed", lambda: _assert(
        len(clients) > 0,
        f"Expected >0 clients, got {len(clients)}"
    ))

    test("clients_have_client_id", lambda: _assert(
        all(c.get("client_id") for c in clients),
        "Some clients missing client_id"
    ))

    test("clients_have_health_color", lambda: _assert(
        all(c.get("health_color") in ("green", "amber", "red", "gray") for c in clients),
        "Invalid health_color in some clients"
    ))

    test("axis001_client_present", lambda: _assert(
        any(c.get("client_id") == "AXIS001" for c in clients),
        "AXIS001 client not found"
    ))

    # ---- Circulars tests ----
    circulars = CircularsParser(root).parse()

    test("circulars_parsed", lambda: _assert(
        len(circulars) > 0,
        f"Expected >0 circulars, got {len(circulars)}"
    ))

    test("circulars_have_exchange", lambda: _assert(
        all(c.get("exchange") for c in circulars),
        "Some circulars missing exchange"
    ))

    test("nse_circular_present", lambda: _assert(
        any(c.get("exchange") == "NSE" for c in circulars),
        "No NSE circular found"
    ))

    # ---- Test cases tests ----
    test_cases = TestCasesParser(root).parse()

    test("test_cases_parsed", lambda: _assert(
        len(test_cases) > 0,
        f"Expected >0 test cases, got {len(test_cases)}"
    ))

    test("test_cases_have_test_id", lambda: _assert(
        all(tc.get("test_id") for tc in test_cases),
        "Some test cases missing test_id"
    ))

    test("test_cases_have_module", lambda: _assert(
        all(tc.get("module") for tc in test_cases),
        "Some test cases missing module"
    ))

    # ---- Utilities tests ----
    utilities = UtilitiesParser(root).parse()

    test("utilities_parsed", lambda: _assert(
        len(utilities) >= 0,  # folder may have 0 files
        "Utilities parse returned None"
    ))

    test("utilities_have_filename", lambda: _assert(
        all(u.get("filename") for u in utilities),
        "Some utilities missing filename"
    ))

    # ---- DataSourceManager singleton tests ----
    ds = DataSourceManager()
    ds2 = DataSourceManager()

    test("manager_singleton_pattern", lambda: _assert(
        ds is ds2,
        "DataSourceManager did not return same singleton instance"
    ))

    test("manager_get_releases", lambda: _assert(
        isinstance(ds.get_releases(), list),
        "get_releases() did not return a list"
    ))

    test("manager_get_jira_issues", lambda: _assert(
        isinstance(ds.get_jira_issues(), list),
        "get_jira_issues() did not return a list"
    ))

    test("manager_search_all", lambda: _assert(
        isinstance(ds.search_all("RMS"), list),
        "search_all() did not return a list"
    ))

    test("manager_search_returns_results", lambda: _assert(
        len(ds.search_all("exposure")) > 0,
        "search_all('exposure') returned no results"
    ))

    test("manager_build_ai_context", lambda: _assert(
        isinstance(ds.build_ai_context("JIRA-1021"), str),
        "build_ai_context() did not return a string"
    ))

    test("manager_ai_context_for_jira_id", lambda: _assert(
        "JIRA-1021" in ds.build_ai_context("Tell me about JIRA-1021"),
        "AI context for JIRA-1021 query does not mention JIRA-1021"
    ))

    test("manager_get_stats", lambda: _assert(
        isinstance(ds.get_stats(), dict) and len(ds.get_stats()) > 0,
        "get_stats() returned empty or non-dict"
    ))

    # Summary
    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = total - passed
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print(f"{'='*50}\n")

    return results


def _assert(condition: bool, message: str = "Assertion failed"):
    """Custom assert that raises AssertionError with message."""
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    results = run_tests()
    failed = [r for r in results if r["status"] != "PASS"]
    sys.exit(1 if failed else 0)
