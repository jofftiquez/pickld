import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { retryItem } from '@/lib/queue/store';

import { retryUpload } from '../retryUpload';

jest.mock('@/lib/queue/store', () => ({ retryItem: jest.fn() }));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn() }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const order: string[] = [];

beforeEach(() => {
  order.length = 0;
  jest
    .mocked(retryItem)
    .mockReset()
    .mockImplementation(async (id) => {
      order.push(`retry:${id}`);
      return {} as never;
    });
  jest
    .mocked(requestUploads)
    .mockReset()
    .mockImplementation(async () => {
      order.push('requestUploads');
    });
  jest.mocked(captureError).mockReset();
});

describe('retryUpload (Retry on a failed tile)', () => {
  it('resets the queue item, then asks the worker to drain now', async () => {
    await retryUpload(7);
    expect(order).toEqual(['retry:7', 'requestUploads']);
    expect(captureError).not.toHaveBeenCalled();
  });

  it('does not kick the worker when the item can’t be retried (already retried or uploaded)', async () => {
    jest.mocked(retryItem).mockRejectedValueOnce(new Error('Cannot retry an item that is queued'));
    await retryUpload(7);
    expect(requestUploads).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'retry-upload' });
  });
});
