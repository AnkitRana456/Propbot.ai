import { describe, it, expect } from 'vitest';
import { widget } from '../src/index.js';

describe('@propbot/widget', () => {
  it('initializes and toggles open/close state', () => {
    expect(widget.state.isOpen).toBe(false);
    expect(widget.state.isConfigured).toBe(false);

    widget.init({ publicKey: 'pk_test_12345' });
    expect(widget.state.isConfigured).toBe(true);

    widget.open();
    expect(widget.state.isOpen).toBe(true);

    widget.close();
    expect(widget.state.isOpen).toBe(false);
  });
});
