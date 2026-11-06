import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER, StorageProvider } from './storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

function resolveProvider(config: ConfigService): StorageProvider {
  const logger = new Logger('StorageModule');
  const kind = (
    config.get<string>('storageProvider') ||
    process.env.STORAGE_PROVIDER ||
    'local'
  )
    .trim()
    .toLowerCase();

  if (kind === 's3' || kind === 'object' || kind === 'liara') {
    logger.log(`Using S3/object storage provider (STORAGE_PROVIDER=${kind})`);
    return new S3StorageProvider(config);
  }

  const nodeEnv = (process.env.NODE_ENV || config.get<string>('nodeEnv') || '').toLowerCase();
  if (nodeEnv === 'production') {
    logger.warn(
      'STORAGE_PROVIDER is local while NODE_ENV=production. ' +
        'For multi-instance deploys set STORAGE_PROVIDER=s3 (or liara/object) with S3_* env vars. ' +
        'Local disk is not shared across instances and is not durable.',
    );
  }

  logger.log(`Using local filesystem storage (STORAGE_PROVIDER=${kind || 'local'})`);
  return new LocalStorageProvider(config);
}

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) => resolveProvider(config),
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
