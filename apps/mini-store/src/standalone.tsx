import { parseCapture } from './capture';
import { startCapture } from './capture-view';
import { mount } from './mount';

const el = document.getElementById('app');
const shape = parseCapture(location.search);
if (el && shape) void startCapture(el);
else if (el) mount(el);
