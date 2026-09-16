#!/usr/bin/env python3
"""Align /admin/content and /admin/site-builder responses with site-builder UI."""
from pathlib import Path

ops = Path('backend/src/admin/admin-ops.controller.ts')
ot = ops.read_text()

old_get_content = '''  @Get('content')
  async getContent() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } });
    return (row?.value as object) ?? { hero: {}, texts: {}, features: {} };
  }'''

new_get_content = '''  @Get('content')
  async getContent() {
    const [draftRow, publishedRow] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } }),
    ]);
    const empty = { hero: {}, texts: {}, features: {} };
    const draftRaw = (draftRow?.value as any) || {};
    // Accept either flat {hero,texts,features} or nested {content:{...}}
    const draft = {
      hero: draftRaw.hero ?? draftRaw.content?.hero ?? {},
      texts: draftRaw.texts ?? draftRaw.content?.texts ?? {},
      features: draftRaw.features ?? draftRaw.content?.features ?? {},
      updatedAt: draftRaw.updatedAt ?? null,
    };
    const pubRaw = (publishedRow?.value as any) || {};
    const publishedContent = pubRaw.content || {
      hero: pubRaw.hero || {},
      texts: pubRaw.texts || {},
      features: pubRaw.features || {},
    };
    const published = publishedRow
      ? {
          hero: publishedContent.hero || {},
          texts: publishedContent.texts || {},
          features: publishedContent.features || {},
          publishedAt: pubRaw.publishedAt || null,
          updatedAt: pubRaw.updatedAt || pubRaw.publishedAt || null,
        }
      : null;
    const hasUnpublishedChanges =
      JSON.stringify({
        hero: draft.hero || {},
        texts: draft.texts || {},
        features: draft.features || {},
      }) !==
      JSON.stringify({
        hero: published?.hero || {},
        texts: published?.texts || {},
        features: published?.features || {},
      });
    return {
      draft: Object.keys(draft.hero || {}).length || Object.keys(draft.texts || {}).length || Object.keys(draft.features || {}).length
        ? draft
        : (Object.keys(empty).length ? { ...empty, ...draft } : empty),
      published,
      hasUnpublishedChanges: published ? hasUnpublishedChanges : true,
    };
  }'''

if old_get_content in ot:
    ot = ot.replace(old_get_content, new_get_content, 1)
    print('getContent fixed')
else:
    print('getContent pattern miss')

old_get_builder = '''  @Get('site-builder')
  async getSiteBuilder() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } });
    const val = row?.value as any;
    if (Array.isArray(val)) return val;
    return Array.isArray(val?.sections) ? val.sections : [];
  }'''

new_get_builder = '''  @Get('site-builder')
  async getSiteBuilder() {
    const [draftRow, publishedRow] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } }),
    ]);
    const normalize = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (Array.isArray(val?.sections)) return val.sections;
      return [];
    };
    const draftSections = normalize(draftRow?.value);
    const publishedSections = normalize((publishedRow?.value as any)?.sections);
    const hasUnpublishedChanges =
      JSON.stringify(draftSections) !== JSON.stringify(publishedSections);
    return {
      draft: { sections: draftSections },
      published: publishedRow ? { sections: publishedSections } : null,
      hasUnpublishedChanges: publishedRow ? hasUnpublishedChanges : true,
    };
  }'''

if old_get_builder in ot:
    ot = ot.replace(old_get_builder, new_get_builder, 1)
    print('getSiteBuilder fixed')
else:
    print('getSiteBuilder pattern miss')

ops.write_text(ot)

# Normalize public published config shape for homepage
svc = Path('backend/src/admin/admin.service.ts')
st = svc.read_text()
old_pub = '''  async getPublishedSiteConfig() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } });
    return (row?.value as object) ?? { version: 1, sections: [] };
  }'''
new_pub = '''  async getPublishedSiteConfig() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } });
    const value = (row?.value as any) || {};
    const nested = value.content || {};
    const content = {
      hero: nested.hero || value.hero || {},
      texts: nested.texts || value.texts || {},
      features: nested.features || value.features || {},
    };
    return {
      version: value.version || 1,
      content,
      sections: Array.isArray(value.sections) ? value.sections : [],
      publishedAt: value.publishedAt || null,
    };
  }'''
if old_pub in st:
    svc.write_text(st.replace(old_pub, new_pub, 1))
    print('getPublishedSiteConfig fixed')
else:
    print('getPublishedSiteConfig pattern miss')

print('DONE')
