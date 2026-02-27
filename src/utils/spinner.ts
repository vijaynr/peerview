type Spinner = {
  start: () => Spinner;
  succeed: (text?: string) => Spinner;
  fail: (text?: string) => Spinner;
};

class FallbackSpinner implements Spinner {
  constructor(private text: string) {}

  start(): Spinner {
    console.log(this.text);
    return this;
  }

  succeed(text?: string): Spinner {
    if (text) {
      console.log(text);
    }
    return this;
  }

  fail(text?: string): Spinner {
    if (text) {
      console.error(text);
    }
    return this;
  }
}

export async function createSpinner(text: string): Promise<Spinner> {
  return new FallbackSpinner(text);
}
