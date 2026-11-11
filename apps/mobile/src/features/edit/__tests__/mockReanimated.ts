// Fills in Reanimated for tests rendered with `expo-router/testing-library`. That library installs its own
// Reanimated mock on import, which comes out empty under this Jest setup and is cached before a test file's
// own jest.mock could replace it, so the stand-in's hooks are copied onto it. Import after the library.
import * as standIn from './reanimatedStandIn';

Object.assign(jest.requireMock<Record<string, unknown>>('react-native-reanimated'), standIn, { __esModule: true });
