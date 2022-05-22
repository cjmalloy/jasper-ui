import { EmbedPipe } from './embed.pipe';

describe('EmbedPipe', () => {
  it('create an instance', () => {
    const pipe = new EmbedPipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
