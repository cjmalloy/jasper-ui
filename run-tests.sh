#!/bin/bash
set -e

# Create output directories
mkdir -p ./tests
mkdir -p ./report

# Run tests with multiple reporters
echo "Running Vitest tests..."
npx ng test --watch=false --reporters=default --reporters=junit --reporters=json > ./tests/test-output.log 2>&1 || true

# Extract the junit XML from the output
grep -A 99999 '<?xml version' ./tests/test-output.log | grep -B 99999 '</testsuites>' > ./tests/junit-report.xml || echo "No JUnit XML found"

# Extract JSON output if present
# Note: Vitest JSON reporter outputs to a file, not stdout

# Generate a simple HTML report from the test output
cat > ./report/index.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Vitest Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .summary {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
        }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .duration { color: #2196F3; }
        pre {
            background: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .log-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>🧪 Vitest Test Report</h1>
EOF

# Parse test results from the log
TOTAL_TESTS=$(grep -o "Test Files.*passed" ./tests/test-output.log | tail -1 || echo "")
DURATION=$(grep -o "Duration.*" ./tests/test-output.log | tail -1 || echo "")

cat >> ./report/index.html <<EOF
    <div class="summary">
        <h2>Test Summary</h2>
        <div class="stats">
EOF

# Extract pass/fail counts
if grep -q "Test Files" ./tests/test-output.log; then
    PASSED_FILES=$(grep -oP '\d+(?= passed)' ./tests/test-output.log | head -1 || echo "0")
    FAILED_FILES=$(grep -oP '\d+(?= failed)' ./tests/test-output.log | head -1 || echo "0")
    TOTAL_FILES=$(grep -oP 'Test Files.*\((\d+)\)' ./tests/test-output.log | grep -oP '\d+(?=\))' | head -1 || echo "0")
    
    cat >> ./report/index.html <<EOF
            <div class="stat">
                <div class="stat-label">Total Test Files</div>
                <div class="stat-value">${TOTAL_FILES}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Passed Files</div>
                <div class="stat-value passed">${PASSED_FILES}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Failed Files</div>
                <div class="stat-value failed">${FAILED_FILES}</div>
            </div>
EOF
fi

# Extract test counts
if grep -q "Tests" ./tests/test-output.log; then
    PASSED_TESTS=$(grep -oP 'Tests.*\d+ failed \| (\d+) passed' ./tests/test-output.log | grep -oP '\d+ passed' | grep -oP '\d+' | head -1 || echo "0")
    FAILED_TESTS=$(grep -oP '(\d+) failed' ./tests/test-output.log | grep -oP '\d+' | head -1 || echo "0")
    TOTAL_TESTS=$(grep -oP 'Tests.*\((\d+)\)' ./tests/test-output.log | grep -oP '\d+(?=\))' | head -1 || echo "0")
    
    cat >> ./report/index.html <<EOF
            <div class="stat">
                <div class="stat-label">Total Tests</div>
                <div class="stat-value">${TOTAL_TESTS}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Passed Tests</div>
                <div class="stat-value passed">${PASSED_TESTS}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Failed Tests</div>
                <div class="stat-value failed">${FAILED_TESTS}</div>
            </div>
EOF
fi

if [ -n "$DURATION" ]; then
    cat >> ./report/index.html <<EOF
            <div class="stat">
                <div class="stat-label">Duration</div>
                <div class="stat-value duration">$(echo "$DURATION" | grep -oP '\d+\.?\d*s' || echo "N/A")</div>
            </div>
EOF
fi

cat >> ./report/index.html <<'EOF'
        </div>
    </div>
    
    <div class="log-section">
        <h2>Test Output</h2>
        <pre>
EOF

# Add the test output
cat ./tests/test-output.log >> ./report/index.html

cat >> ./report/index.html <<'EOF'
        </pre>
    </div>
    
    <div class="summary">
        <p><em>Generated on $(date)</em></p>
    </div>
</body>
</html>
EOF

echo "✅ Test report generated at ./report/index.html"
echo "✅ JUnit XML report at ./tests/junit-report.xml"

# Copy to Docker output locations if they exist
if [ -d "/tests" ]; then
    cp -r ./tests/* /tests/ 2>/dev/null || true
fi
if [ -d "/report" ]; then
    cp -r ./report/* /report/ 2>/dev/null || true
fi

# Exit with success (don't fail the build based on test results here)
exit 0
