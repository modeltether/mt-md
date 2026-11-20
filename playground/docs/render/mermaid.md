# Mermaid

## Flowchart

```mermaid
flowchart LR
    A[Start] --> B{Choice}
    B -->|yes| C[Do it]
    B -->|no| D[Skip]
    C --> E[End]
    D --> E
```

## Sequence

```mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
```

## State

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running: start
    Running --> Idle: stop
    Running --> [*]: crash
```

## Class

```mermaid
classDiagram
    Animal <|-- Dog
    Animal : +name
    Animal : +eat()
    Dog : +bark()
```

## Entity relationship

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE : contains
```

## Gantt

```mermaid
gantt
    title Plan
    dateFormat YYYY-MM-DD
    section A
    Task one :a1, 2026-01-01, 5d
    Task two :after a1, 4d
```

## Pie

```mermaid
pie title Pets
    "Dogs" : 5
    "Cats" : 3
    "Fish" : 2
```

## A diagram with a mistake

```mermaid
flowchart LR
    A --> 
    this is not valid %%%
```

The last one shows a readable error with the source, instead of a blank space.
