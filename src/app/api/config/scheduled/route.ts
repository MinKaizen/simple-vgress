import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readConfigFile, writeConfigFile, getScheduledConfigPath } from '@/lib/storage';
import { validateConfig, parseConfig } from '@/lib/core/utils';

export const dynamic = 'force-dynamic';

// GET /api/config/scheduled - Get scheduled config
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configPath = getScheduledConfigPath();
  const config = readConfigFile(configPath);

  return NextResponse.json({ config });
}

// PUT /api/config/scheduled - Update scheduled config
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const configYaml = body.config;

    // Validate YAML
    try {
      const parsed = parseConfig(configYaml);
      const validation = validateConfig(parsed);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid config: ${validation.errors.join(', ')}` },
          { status: 400 }
        );
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: `Invalid YAML: ${parseError}` },
        { status: 400 }
      );
    }

    const configPath = getScheduledConfigPath();
    writeConfigFile(configPath, configYaml);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
