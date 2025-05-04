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
  onCancel?: () => void;
}

export type QuestionList<Name extends string> = {
  [key in Name]: QuestionOrCallback<Question | null>;
};

type QuestionOrCallback<T extends Question | null> = (() => T | Promise<T>) | T;

export type Question =
  | TextQuestion
  | SelectQuestion<string>
  | MultiSelectQuestion<string>
  | ConfirmQuestion;

export type AnswerList<Questions extends QuestionList<string>> = FlatType<{
  [key in keyof Questions]: Answer<
    Questions[key] extends QuestionOrCallback<infer Q> ? Q : never
  >;
}>;

type Answer<T extends Question | null> = null extends T
  ? undefined | AnswerInternal<NonNullable<T>>
  : AnswerInternal<NonNullable<T>>;

type AnswerInternal<T extends Question> =
  T extends SelectQuestion<infer Choice>
    ? Choice
    : T extends MultiSelectQuestion<infer Choice>
      ? Choice[]
      : T extends ConfirmQuestion
        ? boolean
        : T extends TextQuestion
          ? string
          : never;

type BaseQuestion<Type extends PromptType, Value extends unknown> = {
  type: Type;
  message: string;
  validate?: (value: Value) => boolean | string;
  initial?: Value;
  default?: Value;
};

type TextQuestion = BaseQuestion<'text', string>;

type SelectQuestion<Choice extends string> = BaseQuestion<'select', Choice> & {
  choices: Choice[];
};

type MultiSelectQuestion<Choice extends string> = BaseQuestion<
  'multiselect',
  Choice[]
> & {
  choices: Choice[];
};

type ConfirmQuestion = BaseQuestion<'confirm', boolean>;

type PromptType = 'text' | 'select' | 'multiselect' | 'confirm';

type FlatType<T> = { [K in keyof T]: T[K] } & {};
