
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function searchKnowledge(
  query: string,
  limit = 5
) {
  const filePath = path.join(
    process.cwd(),
    'neptucom-wave-knowledge.md'
  );

  const content = await readFile(filePath, 'utf8');

  const sections = content.split(/(?=^#{2,6}\s)/m);

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);

  const results = sections
    .map(section => {
      const score = words.filter(word =>
        section.toLowerCase().includes(word)
      ).length;

      return {
        title: section.split('\n')[0].replace(/^#+\s*/, ''),
        content: section.slice(0, 4500),
        score
      };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

