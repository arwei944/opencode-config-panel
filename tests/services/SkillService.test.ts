/**
 * SkillService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillService } from '../../core/services/SkillService';
import { MockConfigPort } from '../mocks/MockConfigPort';
import { MockFileSystemPort } from '../mocks/MockFileSystemPort';
import type { SkillInfo } from '../../shared/atoms';

const SKILLS_DIR = '/mock/skills';

describe('SkillService', () => {
  let configPort: MockConfigPort;
  let fsPort: MockFileSystemPort;
  let service: SkillService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      skills: { paths: [SKILLS_DIR] },
    });
    fsPort = new MockFileSystemPort();
    // 创建技能目录和 SKILL.md 带 frontmatter
    fsPort.setFile(SKILLS_DIR + '/test-skill/SKILL.md', [
      '---',
      'name: test-skill',
      'description: 测试技能',
      '---',
      '',
      '# Test',
    ].join('\n'));
    service = new SkillService({
      configPort,
      fileSystemPort: fsPort,
      skillsDir: SKILLS_DIR,
      getSkillFilePath: (name: string) => SKILLS_DIR + '/' + name + '/SKILL.md',
    });
  });

  it('应扫描技能', async () => {
    const result = await service.scan();
    const skills = result.skills;
    const found = skills.find((s: SkillInfo) => s.name === 'test-skill');
    expect(found).toBeDefined();
  });

  it('技能应包含描述', async () => {
    const result = await service.scan();
    const skill = result.skills.find((s: SkillInfo) => s.name === 'test-skill');
    expect(skill).toBeDefined();
    expect(skill!.description).toBe('测试技能');
  });

  it('空目录应返回空列表', async () => {
    const emptyFs = new MockFileSystemPort();
    const emptyService = new SkillService({ configPort, fsPort: emptyFs });
    const result = await emptyService.scan();
    expect(result.skills).toHaveLength(0);
  });
});
