"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const [requestedQuery, setRequestedQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Drop a pending search when the list is left (e.g. a contact was clicked
  // right after typing), otherwise it would navigate back to the list
  useEffect(() => () => clearTimeout(timer.current), []);

  // The URL can change without typing here (e.g. after adding a contact
  // the search is cleared) - then show the URL's query in the field
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== requestedQuery) {
      setValue(urlQuery);
      setRequestedQuery(urlQuery);
    }
  }

  function search(nextValue: string) {
    clearTimeout(timer.current);
    const query = nextValue.trim();
    setRequestedQuery(query);
    startTransition(() => {
      router.replace(query ? `/?q=${encodeURIComponent(query)}` : "/", {
        scroll: false,
      });
    });
  }

  function handleChange(nextValue: string) {
    setValue(nextValue);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(nextValue), DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        search(value);
      }}
    >
      <label htmlFor="contact-search" className="sr-only">
        Поиск по имени
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand" />
      <Input
        id="contact-search"
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            setValue("");
            search("");
          }
        }}
        placeholder="Поиск по имени"
        autoComplete="off"
        className="h-12 bg-card pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Loader2Icon
            className="mr-2 size-4 animate-spin text-brand"
            aria-label="Ищем…"
          />
        ) : (
          value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Очистить поиск"
              onClick={() => {
                setValue("");
                search("");
              }}
            >
              <XIcon />
            </Button>
          )
        )}
      </div>
    </form>
  );
}

export function SearchInputFallback() {
  return (
    <div className="relative w-full">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand" />
      <Input
        disabled
        placeholder="Поиск по имени"
        aria-label="Поиск по имени"
        className="h-12 bg-card pl-12"
      />
    </div>
  );
}
