#!/usr/bin/env python3
"""Wire API version headers + OpenAPI JSON + health fields in main.ts / health.controller."""
from pathlib import Path
import re

main = Path('backend/src/main.ts')
t = main.read_text()
if 'PLACEHOLDER' in t and len(t) < 200:
    raise SystemExit('main.ts PLACEHOLDER')

# import apiVersionHeaders
if 'apiVersionHeaders' not in t:
    if "from './common/filters/http-exception.filter';" in t:
        t = t.replace(
            "from './common/filters/http-exception.filter';",
            "from './common/filters/http-exception.filter';\n"
            "import { apiVersionHeaders } from './common/api-version.middleware';\n"
            "import { API_VERSION_LABEL, APP_VERSION } from './common/api-version';",
            1,
        )
    else:
        raise SystemExit('filter import not found')

# CORS expose headers
if "X-API-Version" not in t:
    t = t.replace(
        "allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Correlation-Id'],",
        "allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Correlation-Id'],\n"
        "    exposedHeaders: ['X-API-Version', 'X-App-Version', 'X-Correlation-Id'],",
        1,
    )

# app.use(apiVersionHeaders) after helmet or before listen
if 'app.use(apiVersionHeaders)' not in t:
    t = t.replace(
        "app.setGlobalPrefix('api/v1');",
        "app.use(apiVersionHeaders);\n  app.setGlobalPrefix('api/v1');",
        1,
    )

# Swagger: always build document; UI only non-prod; always serve openapi.json
old_swagger = '''  if (!isProd) {
    const swagger = new DocumentBuilder()
      .setTitle('Beautijoo API')
      .setDescription('Persian RTL beauty marketplace — زیباگر booking platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger UI enabled at /api/docs (non-production)');
  } else {
    logger.log('Swagger UI disabled in production');
  }'''

new_swagger = '''  {
    const swagger = new DocumentBuilder()
      .setTitle('Beautijoo API')
      .setDescription(
        'Persian RTL beauty marketplace — زیباگر booking platform. ' +
          'Versioning: path /api/v1 · headers X-API-Version / X-App-Version. ' +
          'See docs/API_VERSIONING.md.',
      )
      .setVersion(API_VERSION_LABEL)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    if (!isProd) {
      SwaggerModule.setup('api/docs', app, document);
      logger.log('Swagger UI enabled at /api/docs (non-production)');
    } else {
      logger.log('Swagger UI disabled in production');
    }
    // Public OpenAPI JSON in all environments (codegen / external clients)
    const http = app.getHttpAdapter().getInstance();
    if (http && typeof http.get === 'function') {
      http.get('/api/v1/openapi.json', (_req: unknown, res: { type: (t: string) => void; json: (b: unknown) => void }) => {
        res.type('application/json');
        res.json(document);
      });
      logger.log(`OpenAPI JSON at /api/v1/openapi.json (api=${API_VERSION_LABEL}, app=${APP_VERSION})`);
    }
  }'''

if '/api/v1/openapi.json' in t:
    print('openapi.json already wired')
elif old_swagger in t:
    t = t.replace(old_swagger, new_swagger, 1)
    print('swagger block replaced exact')
else:
    pat = re.compile(
        r"  if \(!isProd\) \{\s*const swagger = new DocumentBuilder\(\)[\s\S]*?logger\.log\('Swagger UI disabled in production'\);\s*\}",
        re.M,
    )
    if pat.search(t):
        t = pat.sub(new_swagger, t, count=1)
        print('swagger block replaced regex')
    else:
        raise SystemExit('swagger block not found')

main.write_text(t)
print('main.ts updated', len(t))

# health.controller — add apiVersion / appVersion to check()
hc = Path('backend/src/health/health.controller.ts')
h = hc.read_text()
if "apiVersion" not in h:
    if "from '../common/decorators/public.decorator';" in h:
        h = h.replace(
            "from '../common/decorators/public.decorator';",
            "from '../common/decorators/public.decorator';\n"
            "import { API_VERSION_LABEL, APP_VERSION } from '../common/api-version';",
            1,
        )
    old_ret = '''    return {
      status: ok ? 'ok' : 'degraded',
      database,
      storage,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };'''
    new_ret = '''    return {
      status: ok ? 'ok' : 'degraded',
      apiVersion: API_VERSION_LABEL,
      appVersion: APP_VERSION,
      database,
      storage,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };'''
    if old_ret not in h:
        raise SystemExit('health return block not found')
    h = h.replace(old_ret, new_ret, 1)
    hc.write_text(h)
    print('health.controller updated')
else:
    print('health already has apiVersion')
