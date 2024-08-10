import { ProxyPipe } from './proxy.pipe';

describe('ProxyPipe', () => {
  it('create an instance', () => {
    const pipe = new ProxyPipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
