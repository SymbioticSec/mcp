interface SecurityResult {
  fail_results: Array<{
    rule_id: string;
    title: string;
    severity: string;
    description: string;
    location: {
      start_line: number;
      end_line: number;
      absolute_filename: string;
      relative_filename: string;
      start_col: number;
      end_col: number;
    };
    snippet: string;
    impact: string;
    confidence_level: string;
    references: string[];
  }>;
  pass_results: any[];
  external_results: any[];
}

export function formatSecurityResults(
  results: string,
  scanType: 'code' | 'infra' | 'combined'
): string {
  try {
    const parsed: SecurityResult = JSON.parse(results);

    if (!parsed.fail_results || parsed.fail_results.length === 0) {
      return `✅ No security issues found`;
    }

    let output = `🔍 **${scanType.toUpperCase()} SCAN RESULTS**\n\n`;
    output += `Found ${parsed.fail_results.length} security issues:\n\n`;

    const severityMap = {
      '1': '🔴 Critical',
      '2': '🔴 HIGH',
      '3': '🟠 MEDIUM',
      '4': '🟡 LOW',
    };
    const groupedByFile: Record<string, typeof parsed.fail_results> = {};

    parsed.fail_results.forEach((issue) => {
      const file = issue.location.relative_filename;
      if (!groupedByFile[file]) groupedByFile[file] = [];
      groupedByFile[file].push(issue);
    });

    Object.entries(groupedByFile).forEach(([file, issues]) => {
      output += `📁 **${file}**\n`;

      issues.forEach((issue, i) => {
        const severity =
          severityMap[issue.severity as keyof typeof severityMap] ||
          '⚪ UNKNOWN';
        const lines =
          issue.location.start_line === issue.location.end_line
            ? `Line ${issue.location.start_line}`
            : `Lines ${issue.location.start_line}-${issue.location.end_line}`;

        output += `\n${severity} **${issue.title}**\n`;
        output += `Rule: ${issue.rule_id} | ${lines}\n`;
        output += `${issue.description}\n\n`;

        if (issue.snippet) {
          const snippetLines = issue.snippet.split('\n');
          const startLine = issue.location.start_line;

          output += `**📋 Vulnerable Code:**\n\`\`\`python\n`;
          snippetLines.forEach((line, i) => {
            const lineNum = startLine + i;
            output += `${lineNum}: ${line}\n`;
          });
          output += `\`\`\`\n\n`;
        }

        if (issue.impact) {
          output += `💥 **Impact**: ${issue.impact}\n\n`;
        }

        if (issue.references && issue.references.length > 0) {
          output += `🔗 **References**: ${issue.references.join(', ')}\n\n`;
        }

        if (i < issues.length - 1) output += `---\n\n`;
      });

      output += `\n`;
    });

    return output;
  } catch (error) {
    return results;
  }
}
