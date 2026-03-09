"""Tests for the APIM Policy Security Scanner."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanner import PolicyScanner, to_sarif

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
RULES = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rules", "rules.yaml")


def test_secure_policy_minimal_findings():
    """Secure policy should have very few or no critical/high findings."""
    scanner = PolicyScanner(RULES)
    findings = scanner.scan_file(os.path.join(FIXTURES, "secure-policy.xml"))
    critical_high = [f for f in findings if f.severity in ("critical", "high")]
    print(f"Secure policy: {len(findings)} total findings, {len(critical_high)} critical/high")
    for f in findings:
        print(f"  [{f.severity}] {f.rule_id}: {f.rule_name}")
    assert len(critical_high) == 0, f"Secure policy should have 0 critical/high findings, got {len(critical_high)}"


def test_insecure_policy_catches_issues():
    """Insecure policy should trigger multiple critical and high findings."""
    scanner = PolicyScanner(RULES)
    findings = scanner.scan_file(os.path.join(FIXTURES, "insecure-policy.xml"))
    critical_high = [f for f in findings if f.severity in ("critical", "high")]
    print(f"Insecure policy: {len(findings)} total findings, {len(critical_high)} critical/high")
    for f in findings:
        print(f"  [{f.severity}] {f.rule_id}: {f.rule_name}")
    assert len(critical_high) >= 5, f"Insecure policy should have >= 5 critical/high findings, got {len(critical_high)}"

    # Check specific rules fire
    rule_ids = {f.rule_id for f in findings}
    expected = {"AUTH001", "RATE001", "CORS001", "NET001"}
    missing = expected - rule_ids
    assert not missing, f"Expected rules not triggered: {missing}"


def test_cors_wildcard_detection():
    """Should catch CORS wildcard with credentials."""
    scanner = PolicyScanner(RULES)
    findings = scanner.scan_file(os.path.join(FIXTURES, "insecure-policy.xml"))
    cors_findings = [f for f in findings if "CORS" in f.rule_id]
    assert len(cors_findings) >= 1, "Should detect CORS wildcard issue"


def test_sarif_output():
    """SARIF output should be valid structure."""
    scanner = PolicyScanner(RULES)
    findings = scanner.scan_file(os.path.join(FIXTURES, "insecure-policy.xml"))
    sarif = to_sarif(findings)
    assert sarif["version"] == "2.1.0"
    assert len(sarif["runs"]) == 1
    assert len(sarif["runs"][0]["results"]) > 0
    assert sarif["runs"][0]["tool"]["driver"]["name"] == "apim-policy-scanner"
    print(f"SARIF output: {len(sarif['runs'][0]['results'])} results, {len(sarif['runs'][0]['tool']['driver']['rules'])} rules")


def test_scan_directory():
    """Should scan all XML files in a directory."""
    scanner = PolicyScanner(RULES)
    findings = scanner.scan_directory(FIXTURES)
    files = {f.file for f in findings}
    assert len(files) >= 1, "Should scan at least one file"
    print(f"Directory scan: {len(findings)} findings across {len(files)} files")


if __name__ == "__main__":
    tests = [
        test_secure_policy_minimal_findings,
        test_insecure_policy_catches_issues,
        test_cors_wildcard_detection,
        test_sarif_output,
        test_scan_directory,
    ]
    passed = 0
    failed = 0
    for test in tests:
        try:
            print(f"\n{'─'*40}")
            print(f"Running: {test.__name__}")
            test()
            print(f"✅ PASSED: {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"💥 ERROR: {test.__name__}: {e}")
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
