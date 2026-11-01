// jsdom has no canvas; pages print as blank unless a test draws its own.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
