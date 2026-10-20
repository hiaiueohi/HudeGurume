(() => {
  if (!matchMedia('print').matches) throw Error('Postal frame check requires print media');
  const pages = [...document.querySelectorAll('#printArea .front-card')];
  if (pages.length !== 3) throw Error('Expected three selected recipients in print output');
  for (const page of pages) {
    const digits = [...page.querySelectorAll('.postal span')];
    if (digits.length !== 7) throw Error('Each recipient needs seven postal code frames');
    for (const digit of digits) {
      const style = getComputedStyle(digit), bounds = digit.getBoundingClientRect();
      if (style.outlineStyle !== 'solid' || parseFloat(style.outlineWidth) <= 0 || style.outlineColor !== 'rgb(232, 170, 170)' || bounds.width <= 0 || bounds.height <= 0)
        throw Error('Postal code frames must remain visible and red when printing: '+JSON.stringify({outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,outlineColor:style.outlineColor,width:bounds.width,height:bounds.height}));
    }
    const bounds = page.getBoundingClientRect();
    if (Math.abs(bounds.width - 100 * 96 / 25.4) > 1 || Math.abs(bounds.height - 148 * 96 / 25.4) > 1)
      throw Error('Postal frames must not change postcard dimensions');
  }
  return {pages: pages.length, framesPerPage: 7, visibleInPrint: true};
})()
