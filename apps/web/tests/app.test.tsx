import { describe, it, expect } from 'vitest';
import React from 'react';
import App from '../src/App.js';

describe('App Component', () => {
  it('instantiates the App component without crashing', () => {
    const element = React.createElement(App);
    expect(element).toBeDefined();
    expect(element.type).toBe(App);
  });
});
