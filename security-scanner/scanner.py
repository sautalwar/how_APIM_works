"""
APIM Policy Security Scanner
Scans Azure API Management policy XML files for security misconfigurations.
Outputs results as JSON or SARIF format for GitHub Security tab integration.
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

import yaml


@dataclass
class Finding:
    rule_id: str
    rule_name: str
    severity: str
    category: str
    owasp: str
    description: str
    recommendation: str
    file: str
    line: Optional[int] = None

    @property
    def sarif_level(self) -> str:
        return {"critical": "error", "high": "error", "medium": "warning", "low": "note"}.get(
            self.severity, "warning"
        )


class PolicyScanner:
    def __init__(self, rules_path: str):
        self.rules = self._load_rules(rules_path)

    def _load_rules(self, path: str) -> list[dict]:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        return data.get("rules", [])

    def scan_file(self, file_path: str) -> list[Finding]:
        findings: list[Finding] = []
        content = Path(file_path).read_text(encoding="utf-8")

        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
        except ET.ParseError as e:
            findings.append(Finding(
                rule_id="PARSE001",
                rule_name="XML Parse Error",
                severity="critical",
                category="syntax",
                owasp="API8",
                description=f"Failed to parse policy XML: {e}",
                recommendation="Fix XML syntax errors",
                file=file_path,
            ))
            return findings

        for rule in self.rules:
            result = self._check_rule(rule, root, content, file_path)
            if result:
                findings.append(result)

        return findings

    def _check_rule(self, rule: dict, root: ET.Element, content: str, file_path: str) -> Optional[Finding]:
        rule_type = rule.get("type", "")

        if rule_type == "required":
            return self._check_required(rule, root, content, file_path)
        elif rule_type == "required_attribute":
            return self._check_required_attribute(rule, root, file_path)
        elif rule_type == "forbidden_content":
            return self._check_forbidden_content(rule, root, file_path)
        elif rule_type == "forbidden_pattern":
            return self._check_forbidden_pattern(rule, content, file_path)
        elif rule_type == "required_pattern":
            return self._check_required_pattern(rule, content, file_path)
        elif rule_type == "attribute_threshold":
            return self._check_attribute_threshold(rule, root, file_path)
        elif rule_type == "compound":
            return self._check_compound(rule, root, file_path)
        elif rule_type == "compound_custom":
            return self._check_compound_custom(rule, root, file_path)
        return None

    def _findall_union(self, root: ET.Element, xpath: str) -> list:
        """Support XPath union expressions (a|b) by splitting and merging results."""
        if "|" in xpath:
            results = []
            for part in xpath.split("|"):
                part = part.strip()
                try:
                    results.extend(root.findall(part))
                except SyntaxError:
                    pass
            return results
        return root.findall(xpath)

    def _check_required(self, rule: dict, root: ET.Element, content: str, file_path: str) -> Optional[Finding]:
        xpath = rule.get("xpath", "")
        elements = self._findall_union(root, xpath)
        if not elements:
            return self._make_finding(rule, file_path)
        return None

    def _check_required_attribute(self, rule: dict, root: ET.Element, file_path: str) -> Optional[Finding]:
        xpath = rule.get("xpath", "")
        attr = rule.get("attribute", "")
        expected = rule.get("expected_value", "")
        elements = self._findall_union(root, xpath)
        if not elements:
            return None  # Element not present; AUTH001 handles that
        for elem in elements:
            val = elem.get(attr, "")
            if val.lower() != expected.lower():
                return self._make_finding(rule, file_path)
        return None

    def _check_forbidden_content(self, rule: dict, root: ET.Element, file_path: str) -> Optional[Finding]:
        xpath = rule.get("xpath", "")
        forbidden = rule.get("forbidden_value", "")
        elements = self._findall_union(root, xpath)
        for elem in elements:
            if elem.text and elem.text.strip() == forbidden:
                return self._make_finding(rule, file_path)
        return None

    def _check_forbidden_pattern(self, rule: dict, content: str, file_path: str) -> Optional[Finding]:
        pattern = rule.get("pattern", "")
        if re.search(pattern, content, re.IGNORECASE):
            return self._make_finding(rule, file_path)
        return None

    def _check_required_pattern(self, rule: dict, content: str, file_path: str) -> Optional[Finding]:
        pattern = rule.get("pattern", "")
        if not re.search(pattern, content, re.IGNORECASE):
            return self._make_finding(rule, file_path)
        return None

    def _check_attribute_threshold(self, rule: dict, root: ET.Element, file_path: str) -> Optional[Finding]:
        xpath = rule.get("xpath", "")
        attr = rule.get("attribute", "")
        max_val = rule.get("max_value", float("inf"))
        elements = self._findall_union(root, xpath)
        for elem in elements:
            val = elem.get(attr, "0")
            try:
                if int(val) > max_val:
                    return self._make_finding(rule, file_path)
            except ValueError:
                pass
        return None

    def _check_compound(self, rule: dict, root: ET.Element, file_path: str) -> Optional[Finding]:
        conditions = rule.get("conditions", [])
        all_match = all(self._findall_union(root, c.get("xpath", "")) for c in conditions)
        if all_match:
            return self._make_finding(rule, file_path)
        return None

    def _check_compound_custom(self, rule: dict, root: ET.Element, file_path: str) -> Optional[Finding]:
        check = rule.get("check", "")
        if check == "cors_credentials_wildcard":
            cors_elems = root.findall(".//cors")
            for cors in cors_elems:
                if cors.get("allow-credentials", "").lower() == "true":
                    origins = cors.findall("allowed-origins/origin")
                    for origin in origins:
                        if origin.text and origin.text.strip() == "*":
                            return self._make_finding(rule, file_path)
        return None

    def _make_finding(self, rule: dict, file_path: str) -> Finding:
        return Finding(
            rule_id=rule["id"],
            rule_name=rule["name"],
            severity=rule.get("severity", "medium"),
            category=rule.get("category", "general"),
            owasp=rule.get("owasp", ""),
            description=rule.get("description", ""),
            recommendation=rule.get("recommendation", ""),
            file=file_path,
        )

    def scan_directory(self, dir_path: str) -> list[Finding]:
        findings: list[Finding] = []
        for xml_file in Path(dir_path).rglob("*.xml"):
            findings.extend(self.scan_file(str(xml_file)))
        return findings


def to_sarif(findings: list[Finding], tool_name: str = "apim-policy-scanner") -> dict:
    """Convert findings to SARIF 2.1.0 format for GitHub Security tab."""
    rules = {}
    results = []

    for f in findings:
        if f.rule_id not in rules:
            rules[f.rule_id] = {
                "id": f.rule_id,
                "name": f.rule_name,
                "shortDescription": {"text": f.rule_name},
                "fullDescription": {"text": f.description},
                "help": {
                    "text": f.recommendation,
                    "markdown": f"**{f.rule_name}**\n\n{f.description}\n\n**Recommendation:** {f.recommendation}\n\n**OWASP:** {f.owasp}",
                },
                "properties": {
                    "security-severity": {"critical": "9.5", "high": "8.0", "medium": "5.5", "low": "3.0"}.get(
                        f.severity, "5.0"
                    )
                },
            }

        results.append({
            "ruleId": f.rule_id,
            "level": f.sarif_level,
            "message": {"text": f"{f.description}. {f.recommendation}"},
            "locations": [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": f.file.replace("\\", "/")},
                        "region": {"startLine": f.line or 1},
                    }
                }
            ],
        })

    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": tool_name,
                        "version": "1.0.0",
                        "informationUri": "https://github.com/your-org/apim-security-scanner",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
            }
        ],
    }


def print_summary(findings: list[Finding]) -> None:
    """Print a human-readable summary."""
    if not findings:
        print("\n✅ No security issues found!")
        return

    by_severity = {}
    for f in findings:
        by_severity.setdefault(f.severity, []).append(f)

    print(f"\n{'='*60}")
    print(f"APIM Policy Security Scan Results")
    print(f"{'='*60}")
    print(f"Total findings: {len(findings)}")
    for sev in ["critical", "high", "medium", "low"]:
        count = len(by_severity.get(sev, []))
        if count:
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}[sev]
            print(f"  {icon} {sev.upper()}: {count}")

    print(f"\n{'─'*60}")
    for f in findings:
        icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(f.severity, "⚪")
        print(f"\n{icon} [{f.rule_id}] {f.rule_name}")
        print(f"  File: {f.file}")
        print(f"  OWASP: {f.owasp} | Category: {f.category}")
        print(f"  Issue: {f.description}")
        print(f"  Fix: {f.recommendation}")


def main():
    parser = argparse.ArgumentParser(description="APIM Policy Security Scanner")
    parser.add_argument("path", help="Path to policy XML file or directory")
    parser.add_argument("--rules", default=os.path.join(os.path.dirname(__file__), "rules", "rules.yaml"),
                        help="Path to rules YAML file")
    parser.add_argument("--format", choices=["json", "sarif", "text"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--output", "-o", help="Output file path (default: stdout)")
    parser.add_argument("--fail-on", choices=["critical", "high", "medium", "low"],
                        default="high", help="Exit with code 1 if findings at this severity or above")
    args = parser.parse_args()

    scanner = PolicyScanner(args.rules)

    target = Path(args.path)
    if target.is_dir():
        findings = scanner.scan_directory(str(target))
    elif target.is_file():
        findings = scanner.scan_file(str(target))
    else:
        print(f"Error: {args.path} not found", file=sys.stderr)
        sys.exit(2)

    if args.format == "sarif":
        output = json.dumps(to_sarif(findings), indent=2)
    elif args.format == "json":
        output = json.dumps([asdict(f) for f in findings], indent=2)
    else:
        print_summary(findings)
        output = None

    if output:
        if args.output:
            Path(args.output).write_text(output, encoding="utf-8")
            print(f"Results written to {args.output}")
        else:
            print(output)

    # Exit code based on severity threshold
    severity_order = ["low", "medium", "high", "critical"]
    threshold_idx = severity_order.index(args.fail_on)
    blocking = [f for f in findings if severity_order.index(f.severity) >= threshold_idx]
    if blocking:
        sys.exit(1)


if __name__ == "__main__":
    main()
