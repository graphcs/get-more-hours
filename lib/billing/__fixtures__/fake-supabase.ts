/**
 * Minimal in-memory stand-in for the Supabase PostgREST client, good enough for
 * the billing/generation code paths. Test-only helper.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

interface Filter {
  op: "eq" | "neq" | "in";
  column: string;
  value: unknown;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `row_${idCounter}`;
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private patch: Row | null = null;
  private limitCount: number | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private selectAfterWrite = false;

  constructor(
    private tables: Tables,
    private table: string
  ) {}

  private rows(): Row[] {
    return (this.tables[this.table] ??= []);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.column] === f.value;
      if (f.op === "neq") return row[f.column] !== f.value;
      return Array.isArray(f.value) && f.value.includes(row[f.column]);
    });
  }

  select() {
    if (this.mode !== "select") this.selectAfterWrite = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ op: "in", column, value });
    return this;
  }

  order() {
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  private run(): { data: unknown; error: unknown } {
    let result: Row[] = [];

    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload as Row];
      result = incoming.map((r) => ({ id: nextId(), ...r }));
      this.rows().push(...result);
      if (!this.selectAfterWrite) return { data: null, error: null };
    } else if (this.mode === "update") {
      result = this.rows().filter((r) => this.matches(r));
      for (const row of result) Object.assign(row, this.patch);
    } else if (this.mode === "delete") {
      result = this.rows().filter((r) => this.matches(r));
      this.tables[this.table] = this.rows().filter((r) => !this.matches(r));
    } else {
      result = this.rows().filter((r) => this.matches(r));
      if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    }

    if (this.singleMode === "maybe") {
      return { data: result[0] ?? null, error: null };
    }
    if (this.singleMode === "single") {
      return result.length
        ? { data: result[0], error: null }
        : { data: null, error: { message: "No rows found", code: "PGRST116" } };
    }
    return { data: result, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabase {
  from(table: string): FakeQuery;
  auth: { getUser(): Promise<{ data: { user: Row | null } }> };
  tables: Tables;
}

export function createFakeSupabase(
  tables: Tables = {},
  user: Row | null = null
): FakeSupabase {
  return {
    tables,
    from(table: string) {
      return new FakeQuery(tables, table);
    },
    auth: {
      async getUser() {
        return { data: { user } };
      },
    },
  };
}
