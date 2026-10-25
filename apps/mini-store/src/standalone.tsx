import { parseCapture } from './capture';
import { startCapture } from './capture-view';

const el = document.getElementById('app');
const shape = parseCapture(location.search);
if (el && shape) void startCapture(el);
