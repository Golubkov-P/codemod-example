
describe('Some feature', () => {
  it('Should do some task', () => {
    browser
      .get('/page')
      .click('.elem')
      .checkMetrics({
        path: '$page.$main.some-block.some-element',
        attrs: {
            action: 'click',
            bool: true,
            ref: 'ref'
        }
      });
  });
});
