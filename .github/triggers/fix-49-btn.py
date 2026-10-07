from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text(encoding='utf-8')

MARKER = 'setReportMsg(null);'
if 'blockCustomer(b.customer' in t and 'loading={busy === `${b.customer.id}:block`}' in t:
    print('button already wired')
else:
    # Find the report ghost button that uses setReportMsg(null)
    idx = t.find(MARKER)
    if idx < 0:
        raise SystemExit('MARKER not found')
    # Find closing </Button> after this marker (the report button)
    close = t.find('</Button>', idx)
    if close < 0:
        raise SystemExit('</Button> not found after marker')
    close_end = close + len('</Button>')
    btn = (
        "\n"
        "                          {b.customer?.id ? (\n"
        "                            <Button\n"
        "                              size=\"sm\"\n"
        "                              variant=\"ghost\"\n"
        "                              className=\"text-red-600 hover:text-red-700\"\n"
        "                              loading={busy === `${b.customer.id}:block`}\n"
        "                              onClick={() => void blockCustomer(b.customer!.id)}\n"
        "                            >\n"
        "                              \u0645\u0633\u062f\u0648\u062f \u06a9\u0631\u062f\u0646 \u0645\u0634\u062a\u0631\u06cc\n"
        "                            </Button>\n"
        "                          ) : null}"
    )
    # Decode unicode escapes in btn label
    btn = btn.encode('utf-8').decode('unicode_escape') if '\\u' in btn else btn
    # Actually the string has \u in source - decode properly
    btn = (
        "\n"
        "                          {b.customer?.id ? (\n"
        "                            <Button\n"
        "                              size=\"sm\"\n"
        "                              variant=\"ghost\"\n"
        "                              className=\"text-red-600 hover:text-red-700\"\n"
        "                              loading={busy === `${b.customer.id}:block`}\n"
        "                              onClick={() => void blockCustomer(b.customer!.id)}\n"
        "                            >\n"
        "                              " + "\u0645\u0633\u062f\u0648\u062f \u06a9\u0631\u062f\u0646 \u0645\u0634\u062a\u0631\u06cc" + "\n"
        "                            </Button>\n"
        "                          ) : null}"
    )
    t = t[:close_end] + btn + t[close_end:]
    p.write_text(t, encoding='utf-8')
    print('inserted, len', len(t))

# Clean tail: keep through first top-level closing brace after `  );`
text = p.read_text(encoding='utf-8')
lines = text.splitlines(True)
out = []
seen = False
for line in lines:
    out.append(line)
    if line.rstrip('\n\r') == '  );':
        seen = True
    if seen and line.rstrip('\n\r') == '}':
        break
final = ''.join(out)
p.write_text(final, encoding='utf-8')
print('lines', len(out))
print('has_block_btn', 'blockCustomer(b.customer' in final)
