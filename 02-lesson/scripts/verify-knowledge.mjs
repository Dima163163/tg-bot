import assert from 'node:assert/strict';
import { env } from 'node:process';

const cases = [
  { question: 'Сколько стоит день в Атласе?', matches: [/900/], source: 'стоимость рабочего места' },
  { question: 'До скольки вы работаете в субботу?', matches: [/20/], source: 'часы работы' },
  { question: 'Сколько стоит переговорная на час и сколько человек она вмещает?', matches: [/600/, /6/], source: 'бронирование переговорной' },
  { question: 'Где взять пароль от Wi-Fi?', matches: [/администратор|ресепшен/i], source: 'интернет и печать' },
  { question: 'Есть ли собственная автомобильная парковка?', matches: [/нет|не (предусмотрена|имеется|предоставляется)/i], source: 'адрес и парковка' },
  { question: 'За сколько часов можно бесплатно отменить переговорную?', matches: [/12/], source: 'отмена бронирования' },
  { question: 'Какая погода завтра в Париже?', fallback: true },
  { question: 'Можно ли прийти с собакой?', fallback: true },
];
try {
  if (!env.RAG_ADMIN_URL || !env.RAG_ADMIN_TOKEN) throw new Error('RAG admin configuration is missing');
  for (const item of cases) {
    const response = await fetch(env.RAG_ADMIN_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
      headers: { Authorization: `Bearer ${env.RAG_ADMIN_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'answer', question: item.question }),
    });
    const result = await response.json();
    console.log(JSON.stringify({ status: response.status, question: item.question, ...result }));
    assert.equal(response.status, 200);
    if (item.fallback) {
      assert.equal(result.answer, 'Мы обрабатываем ваш запрос');
      assert.deepEqual(result.sources, []);
    } else {
      for (const pattern of item.matches) assert.match(result.answer, pattern);
      assert.ok(result.sources.some(source => source.title.includes(item.source)), 'Expected source was not retrieved');
    }
  }
  console.log(JSON.stringify({ passed: cases.length }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Knowledge verification failed');
  process.exitCode = 1;
}
