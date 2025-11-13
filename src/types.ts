export type Prompt<T extends QuestionList<string>> = {
  /**
   * Show the prompt and wait for the user to answer.
   */
  show: (options?: PromptOptions) => Promise<AnswerList<T>>;
  /**
   * Read the current answers from the prompt.
   */
  read: () => FlatType<Partial<AnswerList<T>>>;
};

export type PromptOptions = {
  args?: string[];
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  interactive?: boolean;
  onCancel?: () => void;
};

export type QuestionList<Name extends string> = {
  [key in Name]: QuestionItem<Question | null>;
};

type QuestionItem<T extends Question | null> =
  | (T & {
      description: string;
      alias?: string;
    })
  | {
      description: string;
      alias?: string;
      prompt(): T | Promise<T>;
    };

export type SelectChoice =
  | {
      title?: string;
      description?: string;
      value: string;
    }
  | {
      title: string;
      description?: string;
      value: unknown;
    };

export type Question =
  | TextQuestion
  | SelectQuestion<SelectChoice>
  | MultiSelectQuestion<SelectChoice>
  | ConfirmQuestion
  | SpinnerQuestion<unknown>;

export type AnswerList<Questions extends QuestionList<string>> = FlatType<{
  [key in keyof Questions]: Answer<
    Questions[key] extends QuestionItem<infer Q> ? Q : never
  >;
}>;

type Answer<T extends Question | null> = null extends T
  ? undefined | AnswerInternal<NonNullable<T>>
  : AnswerInternal<NonNullable<T>>;

type AnswerInternal<T extends Question> =
  T extends SelectQuestion<infer Choice>
    ? Choice['value']
    : T extends MultiSelectQuestion<infer Choice>
      ? Choice['value'][]
      : T extends ConfirmQuestion
        ? boolean
        : T extends TextQuestion
          ? string
          : T extends SpinnerQuestion<infer Result>
            ? Result
            : never;

type BaseQuestion<Type extends PromptType, Value> = {
  type: Type;
  message: string;
  validate?: (value: Value) => boolean | string;
  initial?: Value;
};

export type TextQuestion = BaseQuestion<'text', string>;

export type SelectQuestion<Choice extends SelectChoice> = BaseQuestion<
  'select',
  Choice['value']
> & {
  choices: Choice[];
};

export type MultiSelectQuestion<Choice extends SelectChoice> = BaseQuestion<
  'multiselect',
  Choice['value'][]
> & {
  choices: Choice[];
};

export type ConfirmQuestion = BaseQuestion<'confirm', boolean>;

export type SpinnerQuestion<Result> = {
  type: 'spinner';
  message: string;
  task: () => AsyncGenerator<
    { message?: string },
    { value: Result; message?: string }
  >;
};

type PromptType = 'text' | 'select' | 'multiselect' | 'confirm';

type RequiredParameter<T extends string> = `<${T}>`;

type OptionalParameter<T extends string> = `[${T}]`;

type ParameterString<T extends string> =
  | RequiredParameter<T>
  | OptionalParameter<T>
  | `${RequiredParameter<T>} ${string}`
  | `${OptionalParameter<T>} ${string}`;

export type ParameterList<T extends QuestionList<string>> = ParameterString<
  Extract<
    {
      [K in keyof T]: T[K] extends QuestionItem<infer Q>
        ? Q extends { type: 'text' }
          ? K
          : undefined
        : undefined;
    }[keyof T],
    string
  >
>;

type FlatType<T> = { [K in keyof T]: T[K] } & {};
