/**
 * QueryBoundary component tests (client lane: jsdom + Testing Library).
 * Pins the loading → error → empty → success branching, the fallback
 * overrides, and the ErrorState title pass-through.
 */

import { describe, it, expect, jest } from "@jest/globals";
import "@testing-library/jest-dom/jest-globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryBoundary } from "./QueryBoundary";

describe("QueryBoundary", () => {
  it("renders the LoadingState while loading", () => {
    render(
      <QueryBoundary isLoading error={null}>
        <div data-testid="content" />
      </QueryBoundary>
    );
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("passes the loading variant through to LoadingState", () => {
    render(
      <QueryBoundary isLoading error={null} loadingVariant="table" loadingRows={2}>
        <div />
      </QueryBoundary>
    );
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders an inline ErrorState with a working retry button", () => {
    const onRetry = jest.fn<() => void>();
    render(
      <QueryBoundary isLoading={false} error={new Error("boom")} onRetry={onRetry}>
        <div data-testid="content" />
      </QueryBoundary>
    );
    expect(screen.getByTestId("error-state-inline")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-retry-inline"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("honors errorTitle in the page variant (ErrorState title pass-through)", () => {
    render(
      <QueryBoundary
        isLoading={false}
        error="something failed"
        errorTitle="Custom title"
        errorVariant="page"
      >
        <div />
      </QueryBoundary>
    );
    expect(screen.getByTestId("error-title")).toHaveTextContent("Custom title");
    expect(screen.getByTestId("error-message")).toHaveTextContent("something failed");
  });

  it("renders node children on success", () => {
    render(
      <QueryBoundary isLoading={false} error={null}>
        <div data-testid="content">hello</div>
      </QueryBoundary>
    );
    expect(screen.getByTestId("content")).toHaveTextContent("hello");
  });

  it("calls function children with the narrowed data", () => {
    render(
      <QueryBoundary isLoading={false} error={null} data={{ name: "MAIN ENGINE" }}>
        {(data) => <div data-testid="content">{data.name}</div>}
      </QueryBoundary>
    );
    expect(screen.getByTestId("content")).toHaveTextContent("MAIN ENGINE");
  });

  it("renders emptyFallback when function children are given and data is nullish", () => {
    render(
      <QueryBoundary
        isLoading={false}
        error={null}
        data={undefined}
        emptyFallback={<div data-testid="empty" />}
      >
        {() => <div data-testid="content" />}
      </QueryBoundary>
    );
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders nothing for nullish data without an emptyFallback", () => {
    const { container } = render(
      <QueryBoundary isLoading={false} error={null} data={null}>
        {() => <div data-testid="content" />}
      </QueryBoundary>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("prefers loadingFallback and errorFallback over the defaults", () => {
    const { rerender } = render(
      <QueryBoundary isLoading error={null} loadingFallback={<div data-testid="custom-loading" />}>
        <div />
      </QueryBoundary>
    );
    expect(screen.getByTestId("custom-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();

    rerender(
      <QueryBoundary
        isLoading={false}
        error="boom"
        errorFallback={<div data-testid="custom-error" />}
      >
        <div />
      </QueryBoundary>
    );
    expect(screen.getByTestId("custom-error")).toBeInTheDocument();
    expect(screen.queryByTestId("error-state-inline")).not.toBeInTheDocument();
  });

  it("wraps fallbacks (not success children) in the data-testid container", () => {
    const { rerender } = render(
      <QueryBoundary isLoading error={null} data-testid="step-shell">
        <div data-testid="content" />
      </QueryBoundary>
    );
    expect(screen.getByTestId("step-shell")).toBeInTheDocument();

    rerender(
      <QueryBoundary isLoading={false} error={null} data-testid="step-shell">
        <div data-testid="content" />
      </QueryBoundary>
    );
    expect(screen.queryByTestId("step-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
