#!/usr/bin/env python3
"""#73 — multi-select upload + compact gallery thumbnails (lightbox already exists)."""
from pathlib import Path


def main() -> None:
    path = Path('frontend/src/app/zibagar/portfolio/page.tsx')
    t = path.read_text()

    # 1) Multi-file onUpload batch handler
    if 'async function onUploadMany' not in t:
        old_fn = '''  async function onUpload(file: File) {
'''
        if old_fn not in t:
            raise SystemExit('onUpload not found')
        # Insert onUploadMany before onUpload and keep onUpload for single
        batch = '''  async function onUploadMany(fileList: FileList | File[]) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    let remaining = Math.max(0, MAX_PORTFOLIO - items.length);
    if (remaining <= 0) {
      setMsg(
        'سقف رایگان نمونه‌کار پر است. برای آپلود بیشتر از ۱۰۰ مورد می‌توانید نسخه ویژه را تهیه کنید.',
      );
      return;
    }
    const queue = files.slice(0, remaining);
    if (files.length > remaining) {
      setMsg(`فقط ${remaining} فایل تا سقف نمونه‌کار آپلود می‌شود.`);
    }
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i]!;
      setUploadProgress(0);
      setMsg(`آپلود ${i + 1} از ${queue.length}…`);
      try {
        const video = isAllowedVideoFile(file);
        const image = isAllowedImageFile(file);
        if (!video && !image) {
          fail += 1;
          continue;
        }
        if (image && !video && file.size > MAX_IMAGE_BYTES) {
          fail += 1;
          continue;
        }
        if (video && file.size > MAX_VIDEO_BYTES) {
          fail += 1;
          continue;
        }
        if (video) {
          try {
            const sec = await readVideoDuration(file);
            if (sec > MAX_VIDEO_SEC + 0.5) {
              fail += 1;
              continue;
            }
          } catch {
            /* continue */
          }
        }
        await uploadMyMedia(file, 'portfolio', undefined, setUploadProgress);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    await load();
    if (ok && !fail) setMsg(`${ok} فایل با موفقیت آپلود شد.`);
    else if (ok && fail) setMsg(`${ok} موفق، ${fail} ناموفق.`);
    else if (fail) setMsg('آپلود ناموفق بود. فرمت و حجم فایل‌ها را بررسی کنید.');
    try {
      if (ok) toastSuccess(`${ok} فایل آپلود شد`);
    } catch {
      /* */
    }
  }

  async function onUpload(file: File) {
'''
        t = t.replace(old_fn, batch, 1)
        print('onUploadMany added')

    # 2) input multiple + onChange all files
    old_input = '''            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
'''
    new_input = '''            multiple
            onChange={(e) => {
              const list = e.target.files;
              if (list && list.length) void onUploadMany(list);
            }}
'''
    if 'multiple' not in t[t.find('type="file"'):t.find('type="file"') + 400]:
        if old_input in t:
            t = t.replace(old_input, new_input, 1)
            print('input multiple enabled')
        else:
            # try alternate
            t = t.replace(
                'const f = e.target.files?.[0];\n              if (f) void onUpload(f);',
                'const list = e.target.files;\n              if (list && list.length) void onUploadMany(list);',
                1,
            )
            if 'multiple' not in t.split('type="file"')[1][:200]:
                t = t.replace(
                    'type="file"',
                    'type="file"\n            multiple',
                    1,
                )
            print('input multiple (alt)')

    # Button label
    t = t.replace(
        '>آپلود تصویر / ویدیو<',
        '>آپلود چندتایی تصویر / ویدیو<',
        1,
    )

    # 3) denser grid
    t = t.replace(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5',
        1,
    )
    # slightly tighter card padding / rounded
    t = t.replace(
        'Card className="space-y-2 overflow-hidden p-2"',
        'Card className="space-y-1 overflow-hidden p-1.5"',
        1,
    )

    path.write_text(t)
    print('done', path.stat().st_size)


if __name__ == '__main__':
    main()
