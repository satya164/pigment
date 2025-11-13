export type Prompt<
  P extends PositionalArgument[],
  Q extends QuestionList<string>,
> = {
  /**
   * Show the prompt and wait for the user to answer.
   */
  show: (options: PromptOptions) => Promise<AnswerList<P, Q>>;
  /**
   * Read the current answers from the prompt.
   */
  read: () => FlatType<Partial<AnswerList<P, Q>>>;
};

export type PositionalArgument = `<${string}>` | `[${string}]`;

export type PromptOptions = {
  name: string;
  description?: string;
  version?: string;
  args?: string[];
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  interactive?: boolean;
  onExit?: () => void;
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

export type AnswerList<
  P extends PositionalArgument[],
  Q extends QuestionList<string>,
> = FlatType<
  PositionalArgumentValue<P> & {
    [Key in keyof Q]: Answer<Q[Key] extends QuestionItem<infer Q> ? Q : never>;
  }
>;

type PositionalArgumentValue<T extends PositionalArgument[]> =
  UnionToIntersection<
    {
      [K in T[number]]: K extends `<${infer Name}>`
        ? { readonly [Key in Name]: string }
        : K extends `[${infer Name}]`
          ? { readonly [Key in Name]?: string }
          : never;
    }[T[number]]
  >;

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
  initial?: Value | (() => Value | Promise<Value>);
  skip?: boolean | (() => boolean | Promise<boolean>);
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

type FlatType<T> = { [K in keyof T]: T[K] } & {};

export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;
