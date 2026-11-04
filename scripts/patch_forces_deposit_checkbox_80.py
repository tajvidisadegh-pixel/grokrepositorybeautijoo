#!/usr/bin/env python3
"""#80 Phase2.1 — forcesDeposit checkbox on admin option form + toggle."""
from pathlib import Path


def main() -> None:
    path = Path('frontend/src/components/admin/ServicePricingPanel.tsx')
    t = path.read_text()
    if 'بیعانه اجباری' in t and 'toggleForcesDeposit' in t:
        print('already patched')
        return

    # Add toggle function before addOption if missing
    if 'async function toggleForcesDeposit' not in t:
        needle = 'async function addOption(groupId: string)'
        helper = '''async function toggleForcesDeposit(optionId: string, next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/admin/attribute-options/${optionId}`, { forcesDeposit: next });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function addOption(groupId: string)'''
        if needle not in t:
            raise SystemExit('addOption missing')
        t = t.replace(needle, helper, 1)

    # Checkbox under option form grid
    old_grid_end = '''                      <button
                        type="button"
                        disabled={busy || !draft.label.trim()}
                        onClick={() => void addOption(g.id)}
                        className="rounded-xl border border-[#2D6CDF] px-3 py-2 text-xs text-[#2D6CDF] disabled:opacity-50"
                      >
                        + گزینه
                      </button>
                    </div>
                  </div>'''
    new_grid_end = '''                      <button
                        type="button"
                        disabled={busy || !draft.label.trim()}
                        onClick={() => void addOption(g.id)}
                        className="rounded-xl border border-[#2D6CDF] px-3 py-2 text-xs text-[#2D6CDF] disabled:opacity-50"
                      >
                        + گزینه
                      </button>
                    </div>
                    <label className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-900">
                      <input
                        type="checkbox"
                        checked={!!draft.forcesDeposit}
                        onChange={(e) =>
                          setOptionDraft((prev) => ({
                            ...prev,
                            [g.id]: { ...draft, forcesDeposit: e.target.checked },
                          }))
                        }
                      />
                      بیعانه اجباری (اگر مشتری این گزینه را بزند، مسیر رزرو بیعانه می‌شود)
                    </label>
                  </div>'''
    if old_grid_end not in t:
        raise SystemExit('grid end missing')
    t = t.replace(old_grid_end, new_grid_end, 1)

    # Toggle on existing option row
    old_row = '''                          <span>
                            {o.label}
                            <span className="mr-2 text-gray-400">
                              {o.suggestedPriceDelta >= 0 ? '+' : ''}
                              {o.suggestedPriceDelta.toLocaleString('fa-IR')} تومان ·{' '}
                              {o.suggestedDurationDeltaMin >= 0 ? '+' : ''}
                              {o.suggestedDurationDeltaMin} دقیقه
                              {o.forcesDeposit ? ' · بیعانه' : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deactivateOption(o.id)}
                            className="text-[#FF6F61]"
                          >
                            حذف
                          </button>'''
    new_row = '''                          <span>
                            {o.label}
                            <span className="mr-2 text-gray-400">
                              {o.suggestedPriceDelta >= 0 ? '+' : ''}
                              {o.suggestedPriceDelta.toLocaleString('fa-IR')} تومان ·{' '}
                              {o.suggestedDurationDeltaMin >= 0 ? '+' : ''}
                              {o.suggestedDurationDeltaMin} دقیقه
                              {o.forcesDeposit ? ' · بیعانه' : ''}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-[10px] text-amber-800">
                              <input
                                type="checkbox"
                                disabled={busy}
                                checked={!!o.forcesDeposit}
                                onChange={(e) => void toggleForcesDeposit(o.id, e.target.checked)}
                              />
                              بیعانه
                            </label>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deactivateOption(o.id)}
                              className="text-[#FF6F61]"
                            >
                              حذف
                            </button>
                          </div>'''
    if old_row not in t:
        raise SystemExit('option row missing')
    t = t.replace(old_row, new_row, 1)

    path.write_text(t)
    print('patched', path.stat().st_size)


if __name__ == '__main__':
    main()
