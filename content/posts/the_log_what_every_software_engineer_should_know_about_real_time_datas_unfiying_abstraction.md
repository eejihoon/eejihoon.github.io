+++
title = "The Log: What every software engineer should know about real-time data's unifying abstraction"
author = "hoon"
date = "2025-05-18"
summary = "Jay Kreps가 2013년 LinkedIn Engineering Blog에 발행한 'The Log: What every software engineer should know about real-time data's unifying abstraction'을 읽고 번역한다. 로그가 데이터베이스, 분산 시스템, 실시간 데이터 처리 등 다양한 시스템에서 어떻게 핵심적인 역할을 하는지 설명하며, 로그의 개념, 데이터 일관성, 복제, 장애 복구, 이벤트 소싱, 스트림 처리 등 로그 중심 아키텍처의 원리와 실제 적용 사례를 다룬다."
toc = true
readTime = true
autonumber = true
math = true
tags = ["distributed-systems", "logs", "real-time-data", "event-sourcing", "stream-processing", "database", "replication", "system-design"]
showTags = true
hideBackToTop = false
+++

Apache Kafka Documentation을 훑어보다가 카프카의 저자인 Jay Kreps가 링크드인 엔지니어링 블로그에 2013년에 발행한 [The Log: What every software engineer should know about real-time data's unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying) 포스트를 읽게 되었다. Jay Kreps는 Neha Narhede, Jun Rao와 함께 2011년 Kafka의 초석이 되는 [Kafka: A Distributed Messeging System For Log Processing](https://notes.stephenholiday.com/Kafka.pdf) 논문의 원저자 중 한 명이다.

```
I joined LinkedIn about six years ago at a particularly interesting time. We were just beginning to run up against the limits of our monolithic, centralized database and needed to start the transition to a portfolio of specialized distributed systems. This has been an interesting experience: we built, deployed, and run to this day a distributed graph database, a distributed search backend, a Hadoop installation, and a first and second generation key-value store.

One of the most useful things I learned in all this was that many of the things we were building had a very simple concept at their heart: the log. Sometimes called write-ahead logs or commit logs or transaction logs, logs have been around almost as long as computers and are at the heart of many distributed data systems and real-time application architectures.

You can't fully understand databases, NoSQL stores, key value stores, replication, paxos, hadoop, version control, or almost any software system without understanding logs; and yet, most software engineers are not familiar with them. I'd like to change that. In this post, I'll walk you through everything you need to know about logs, including what is log and how to use logs for data integration, real time processing, and system building.
```

Jay Kreps는 링크드인에서 중앙화된 DB와 모놀리스 설계가 한계를 극복하기 위해 분산 그래프 데이터베이스, 분산 검색 백엔드, 하둡 설치, 그리고 1세대와 2세대 key-value 저장소를 구축하고 배포했다.

그는 분산 시스템을 만들면서 이 시스템의 핵심에 로그가 있다는 것을 깨달았다. 로그는 write-ahead log, commit log, transaction log등으로 불리며 컴퓨터가 등장한 이래로 존재했고, 많은 분산 시스템과 실시간 애플리케이션 아키텍처의 핵심에 자리 잡고 있다.

데이터베이스, NoSQL, Key-Value 저장소, Replication, Paxos, 하둡, 버전 컨트롤 또는 거의 모든 소프트웨어 시스템을 이해하기 위해 로그를 알아야 한다. 하지만 대부분의 소프트웨어 엔지니어는 로그에 익숙하지 않다. 그는 이 점을 개선하기 위해 로그란 무엇인지, 로그를 데이터 통합, 실시간 처리과 시스템 구축에 어떻게 활용할 수 있는지에 대해 설명한다.

> **Notes**
>
> **first and second generation key-value store**
>
> 본문에서 말하는 1세대와 2세대 key value 스토어란 링크드인이 자체적으로 구축하고 운영했던 두 세대의 분산 키-값 저장소를 말한다.<br>
> 링크드인은 단순한 설계, 기능 제한, 내구성 문제를 가진 1세대 key-value 저장소인 Voldmort라는 오픈소스 저장소를 개발해 사용했다.
> Voldmort의 한계를 보완하는 2세대 key-value 저장소인 Espresso 분산 데이터베이스를 운영한다.

```
Part One: What Is a Log?
A log is perhaps the simplest possible storage abstraction. It is an append-only, totally-ordered sequence of records ordered by time. It looks like this:

Records are appended to the end of the log, and reads proceed left-to-right. Each entry is assigned a unique sequential log entry number.

The ordering of records defines a notion of "time" since entries to the left are defined to be older then entries to the right. The log entry number can be thought of as the "timestamp" of the entry. Describing this ordering as a notion of time seems a bit odd at first, but it has the convenient property that it is decoupled from any particular physical clock. This property will turn out to be essential as we get to distributed systems.

The contents and format of the records aren't important for the purposes of this discussion. Also, we can't just keep adding records to the log as we'll eventually run out of space. I'll come back to this in a bit.

So, a log is not all that different from a file or a table. A file is an array of bytes, a table is an array of records, and a log is really just a kind of table or file where the records are sorted by time.

At this point you might be wondering why it is worth talking about something so simple? How is a append-only sequence of records in any way related to data systems? The answer is that logs have a specific purpose: they record what happened and when. For distributed data systems this is, in many ways, the very heart of the problem.

But before we get too far let me clarify something that is a bit confusing. Every programmer is familiar with another definition of logging—the unstructured error messages or trace info an application might write out to a local file using syslog or log4j. For clarity I will call this "application logging". The application log is a degenerative form of the log concept I am describing. The biggest difference is that text logs are meant to be primarily for humans to read and the "journal" or "data logs" I'm describing are built for programmatic access.

(Actually, if you think about it, the idea of humans reading through logs on individual machines is something of an anachronism. This approach quickly becomes an unmanageable strategy when many services and servers are involved and the purpose of logs quickly becomes as an input to queries and graphs to understand behavior across many machines—something for which english text in files is not nearly as appropriate as the kind structured log described here.)
```

## 로그란 무엇인가?
로그는 아마 가장 단순한 저장소 추상화(storage abstraction)일 것이다. 로그는 시간 순서대로 정렬되고, 추가만 가능하며append-only, 순서가 보장된 레코드의 시퀀스다.

![log](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/log.png)

레코드는 항상 로그의 끝에 추가되고 왼쪽에서 오른쪽으로 진행된다. 각 항목에는 고유하고 순차적인 로그 엔트리 넘버가 할당된다.

레코드 순서는 시간 개념을 정의한다. 왼쪽에 있는 항목이 오른쪽에 있는 항목보다 더 오래된 것으로 간주된다. 로그 엔트리 번호는 해당 항목의 타임스탬프로 생각할 수 있다. 이러한 순서를 시간 개념으로 설명하는 것이 다소 이상하게 느껴질 수 있지만 이 방식은 실제 물리적 시계와 분리되어 있다는 편의성을 가진다. 이 특성은 분산 시스템을 다룰 때 중요하다.

이 논의에서 레코드 내용과 형식은 중요하지 않다. 또한 계속해서 로그를 저장하는 공간은 언젠가는 부족해지기 때문에 계속해서 레코드를 추가할 수는 없다. 그래서 로그는 파일이나 테이블과 크게 다르지 않다. 파일은 바이트 배열이고 테이블은 레코드 배열이며 로그는 사실상 시간 순서로 정렬된 일종의 테이블이나 파일이다.

이렇게 단순한 것에 대해 말하는 이유를 궁금해 할 수 있다. append-only 레코드 시퀀스가 데이터 시스템과 어떤 관련이 있는지, 이에 대한 답은 무엇이 언제 일어났는지를 기록하는 데 있다. 분산 데이터 시스템에서 이것이 문제의 핵심이다.

하지만 본격적으로 들어가기 전에 혼동될 수 있는 점을 한가지 명확히 하고 싶다. 모든 프로그래머는 또 다른 의미의 로깅, 즉 애플리케이션이 syslog나 log4j 같은 도구로 로컬 파일에 기록하는 비구조화된 에러 메시지나 트레이스 정보를 잘 알고 있다. 여기서는 이를 '애플리케이션 로깅'이라고 부른다. 내가 설명하는 로그 개념의 퇴화된 형태가 바로 이 애플리케이션 로그다. 가장 큰 차이점은 텍스트 로그는 주로 사람이 읽기 위한 것이고 내가 말하는 저널journal 또는 데이터 로그data log는 프로그램이 접근할 수 있도록 만들어졌다는 점이다.

(사실, 각 서버에서 사람이 직접 로그를 읽는다는 생각 자체가 이제는 구시대적이다. 서비스와 서버가 많아질수록 이 방식은 관리가 불가능하다. 로그의 목적은 여러 머신의 동작을 이해하기 위한 쿼리와 그래프의 입력으로 바뀐다. 이런 목적에는 여기서 설명하는 구조화된 로그가 영어 텍스트 파일보다 적합하다.)

> **Notes**
> Jay Kreps는 여기서 진짜 로그는 data log 또는 journal이라고 하고, 애플리케이션 로그를 degenerative log라고 설명한다. 즉, '진짜' 로그란 machine readable한 structured한 데이터여야 한다. 애플리케이션 로그는 본래 로그 개념에서 'human readable' 속성을 위해 축소된, 덜 완성된 형태라는 뉘앙스로 말한다. 현대의 로그는 프로그램이 분석/처리할 수 있게 구조화되어 있어야 하고, 이것을 쿼리, 집계 등에 사용해서 시스템 전체 동작을 이해하는 데 사용해야 한다.


```
Logs in databases
I don't know where the log concept originated—probably it is one of those things like binary search that is too simple for the inventor to realize it was an invention. It is present as early as IBM's System R. The usage in databases has to do with keeping in sync the variety of data structures and indexes in the presence of crashes. To make this atomic and durable, a database uses a log to write out information about the records they will be modifying, before applying the changes to all the various data structures it maintains. The log is the record of what happened, and each table or index is a projection of this history into some useful data structure or index. Since the log is immediately persisted it is used as the authoritative source in restoring all other persistent structures in the event of a crash.

Over-time the usage of the log grew from an implementation detail of ACID to a method for replicating data between databases. It turns out that the sequence of changes that happened on the database is exactly what is needed to keep a remote replica database in sync. Oracle, MySQL, and PostgreSQL include log shipping protocols to transmit portions of log to replica databases which act as slaves. Oracle has productized the log as a general data subscription mechanism for non-oracle data subscribers with their XStreams and GoldenGate and similar facilities in MySQL and PostgreSQL are key components of many data architectures.

Because of this origin, the concept of a machine readable log has largely been confined to database internals. The use of logs as a mechanism for data subscription seems to have arisen almost by chance. But this very abstraction is ideal for supporting all kinds of messaging, data flow, and real-time data processing.
```

### 데이터베이스에서 로그
나는 로그라는 개념이 어디서 시작되었는지 정확히 알지 못한다. 아마도 이진 탐색처럼 너무 단순해서 발명가조차 그것이 발명이라는 사실을 인식하지 못했을지도 모른다. 로그는 IBM의 System R에서도 이미 존재했다. 데이터베이스에서 로그의 사용 목적은 장애crash가 발생했을 때 다양한 데이터 구조와 인덱스를 동기화된 상태로 유지하는 데 있다. 이런 작업을 원자적이고 내구성 있게 만들기 위해 데이터베이스는 변경하려는 레코드에 대한 정보를 로그에 먼저 기록한 후 자신이 관리하는 여러 데이터 구조에 변경을 적용한다. 로그는 '무엇이 일어났는지'에 대한 기록이며, 각 테이블이나 인덱스는 이 기록을 어떤 유용한 데이터 구조나 인덱스로 투영projection한 결과다. 로그는 즉시 영구 저장persist되기 때문에, 장애가 발생했을 때 다른 모든 영구적 구조를 복구하는 데 있어 권위 있는 소스로 사용된다.

시간이 흐르면서 로그의 사용은 ACID의 구현 세부사항에서 데이터베이스 간 복제replicating data의 방법으로 발전했다. 데이터베이스에서 일어난 변경사항의 시퀀스는 원격 복제 데이터베이스remote replica database를 동기화 상태로 유지하는 데 꼭 필요한 정보임이 드러났다. Oracle, MySQL, ProstgreSQL 등은 로그 일부를 복제 데이터베이스slave로 전송하는 로그 배송log shipping 프로토콜을 포함한다. Oracle은 XStreams, GoldenGate와 같은 제품을 통해 오라클이 아닌 데이터 구독자non-oracle data subscribers에게도 로그를 일반적인 데이터 구독 메커니즘으로 제공한다. MySQL과 PostgreSQL의 유사한 기능 역시 많은 데이터 아키텍처에서 핵심적인 역할을 한다.

이런 기원 때문에 기계가 읽을 수 있는 로그의 개념은 주로 데이터베이스 내부에 국한되어 있었다. 로그를 데이터 구독 메커니즘으로 사용하는 것은 거의 우연히 등장한 것처럼 보인다. 하지만 바로 이 추상화가 모든 종류의 메시징, 데이터 흐름, 실시간 데이터 처리를 지원하는 데 이상적이다.

```
Logs in distributed systems
The two problems a log solves—ordering changes and distributing data—are even more important in distributed data systems. Agreeing upon an ordering for updates (or agreeing to disagree and coping with the side-effects) are among the core design problems for these systems.

The log-centric approach to distributed systems arises from a simple observation that I will call the State Machine Replication Principle:

If two identical, deterministic processes begin in the same state and get the same inputs in the same order, they will produce the same output and end in the same state.
This may seem a bit obtuse, so let's dive in and understand what it means.

Deterministic means that the processing isn't timing dependent and doesn't let any other "out of band" input influence its results. For example a program whose output is influenced by the particular order of execution of threads or by a call to gettimeofday or some other non-repeatable thing is generally best considered as non-deterministic.

The state of the process is whatever data remains on the machine, either in memory or on disk, at the end of the processing.

The bit about getting the same input in the same order should ring a bell—that is where the log comes in. This is a very intuitive notion: if you feed two deterministic pieces of code the same input log, they will produce the same output.

The application to distributed computing is pretty obvious. You can reduce the problem of making multiple machines all do the same thing to the problem of implementing a distributed consistent log to feed these processes input. The purpose of the log here is to squeeze all the non-determinism out of the input stream to ensure that each replica processing this input stays in sync.

When you understand it, there is nothing complicated or deep about this principle: it more or less amounts to saying "deterministic processing is deterministic". Nonetheless, I think it is one of the more general tools for distributed systems design.

One of the beautiful things about this approach is that the time stamps that index the log now act as the clock for the state of the replicas—you can describe each replica by a single number, the timestamp for the maximum log entry it has processed. This timestamp combined with the log uniquely captures the entire state of the replica.

There are a multitude of ways of applying this principle in systems depending on what is put in the log. For example, we can log the incoming requests to a service, or the state changes the service undergoes in response to request, or the transformation commands it executes. Theoretically, we could even log a series of machine instructions for each replica to execute or the method name and arguments to invoke on each replica. As long as two processes process these inputs in the same way, the processes will remaining consistent across replicas.

Different groups of people seem to describe the uses of logs differently. Database people generally differentiate between physical and logical logging. Physical logging means logging the contents of each row that is changed. Logical logging means logging not the changed rows but the SQL commands that lead to the row changes (the insert, update, and delete statements).

The distributed systems literature commonly distinguishes two broad approaches to processing and replication. The "state machine model" usually refers to an active-active model where we keep a log of the incoming requests and each replica processes each request. A slight modification of this, called the "primary-backup model", is to elect one replica as the leader and allow this leader to process requests in the order they arrive and log out the changes to its state from processing the requests. The other replicas apply in order the state changes the leader makes so that they will be in sync and ready to take over as leader should the leader fail.
```

### 분산 시스템에서 로그
로그가 해결하는 두 가지 문제ㅡ변경 사항의 순서 지정과 데이터 분산ㅡ는 분산 데이터 시스템에서 더욱 중요하다. 업데이트 순서를 합의하는 것(혹은 합의하지 못하더라도 그 부작용side effects을 처리하는 것)은 이러한 시스템의 핵심 설계 문제 중 하나다.

분산 시스템에서 로그 중심적인 접근법은 '상태 기계 복제 원칙State Machine Replication Principle'이라고 부르는 단순한 관찰에서 비롯된다.

> 만약 두 개의 동일하고 결정적인deterministic 프로세스가 같은 상태에서 시작해, 같은 순서로 같은 입력을 받는다면 이들은 같은 출력을 내고 같은 상태로 끝난다.

이것은 다소 난해하다. 여기서 '결정적deterministic'이라는 것은 처리 과정이 타이밍에 의존하지 않고 다른 외부 입력out of band input이 결과에 영향을 주지 않는다는 뜻이다. 예를 들어, 스레드 실행 순서에 따라 결과가 달라지거나 `gettimeofday` 같은 반복 불가능한 함수 호출에 의해 결과가 달라지는 프로그램은 일반적으로 비결정적non-deterministic이라고 본다.

프로세스 상태란 처리 과정이 끝난 후 메모리나 디스크에 남아 있는 모든 데이터를 의미한다.

같은 입력을 같은 순서로 받는다는 점이 바로 로그가 등장하는 부분이다. 이는 매우 직관적인 개념이다. 두 개의 결정적인 코드에 동일한 입력 로그를 제공하면 이들은 동일한 출력을 낸다.

이 원칙을 분산 컴퓨팅에 적용하는 것은 명확하다. 여러 대의 기계가 모두 같은 동작을 하도록 만드는 문제를, 이 프로세스들에게 입력을 제공하는 분산 일관성 로그distributed consistent log를 구현하는 문제로 환원할 수 있다. 여기서 로그의 목적은 입력 스트림에서 모든 비결정성을 제거하여, 각 복제본replica이 이 입력을 처리할 때 항상 동기화된 상태를 유지하는 것이다.

이 원칙을 이해하면 복잡하거나 심오한 것이 아니라 '결정적인 처리는 결정적'이라는 말과 다르지 않다. 그럼에도 이것이 분산 시스템에서 가장 일반적인 도구 중 하나라고 생각한다.

이 접근법의 아름다움 중 하나는 로그 인덱싱하는 타임스탬프가 이제 복제본 상태를 나타내는 시계 역할을 한다는 것이다. 각 복제본은 자신이 처리한 최대 로그 엔트리의 타임스탬프라는 단일 숫자로 표현할 수 있다. 이 타임스탬프와 로그를 조합하면 복제본 전체 상태를 고유하게 포착할 수 있다.

이 원칙을 시스템에 적용하는 방법은 로그에 무엇을 기록하느냐에 따라 다양하다. 예를 들어, 서비스에 들어오는 요청을 로그로 남길 수도 있고, 요청에 대한 서비스 상태 변화를 기록할 수도 있으며 서비스가 실행하는 변환 명령을 기록할 수도 있다. 이론적으로는 각 복제본이 실행할 일련의 기계 명령어나 각 복제본에서 호출할 메서드 이름과 인자를 로그로 남길 수도 있다. 두 프로세스가 이러한 입력을 동일하게 처리하는 한, 이들은 복제본 간에 일관성을 유지할 수 있다.

사람마다 로그의 용도를 다르게 설명하는 것 같다. 데이터베이스 분야에서는 일반적으로 물리적physical 로깅과 논리적logical 로깅을 구분한다. 물리적 로깅은 변경된 각 행row의 내용을 기록하는 것이고, 논리적 로깅은 변경된 행이 아니라 그 행을 변경하게 만든 SQL 명령문(INSERT, UPDATE, DELETE 등)을 기록하는 것이다.

분산 시스템 분야 문헌에는 처리와 복제에 대해 두 가지 큰 접근법을 구분한다. '상태 기계 모델state machine model'은 보통 Active-Active 모델을 의미하는데, 여기서는 들어오는 요청 로그를 남기고 각 복제본이 모든 요청을 처리한다. 이와 약간 다른 Primary-Backup 모델은 한 복제본을 리더로 선출하고, 이 리더가 도착한 순서대로 요청을 처리하며, 그 처리 결과로 상태가 어떻게 바뀌었는지를 로그로 남긴다. 다른 복제본들은 리더가 만든 상태 변화를 순서대로 적용하여, 리더 장애가 나면 바로 리더 역할을 넘겨받을 수 있도록 동기화 상태를 유지한다.

> **Notes**
> - **상태 기계 복제 원칙State Machine Replication Principle**
>   - 동일한 입력을 동일한 순서로 처리하면, 결정적인 시스템은 항상 같은 결과와 상태에 도달한다는 원칙이다. 분산 시스템에서 여러 복제본이 일관성을 유지하는 핵심 이론이다.
> - **Deterministic**
>   - 입력과 상태만 같으면 항상 같은 결과를 내는 시스템을 말한다. 타이밍, 외부 요인, 비동기 이벤트 등에 따라 결과가 달라지면 비결정적non-deterministic이다.
> - **Physical vs. Logical Logging**
>   - physical log: 실제 데이터(행의 값) 자체를 기록
>   - logical log : 데이터 변경을 일으킨 명령(SQL 등)을 기록
> 복구나 복제 시 어떤 정보를 기반으로 재구성할지에 따라 장단점이 있다.
> - **State Machine Model vs. Primary-Backup Model**
>   - State Machine Model: 모든 복제본이 모든 요청을 직접 처리(Active-Active)
>   - Primary-Backup Model: 한 리더가 처리하고, 나머지 리더의 상태 변화를 따라감(Active-Passive)

```
To understand the difference between these two approaches, let's look at a toy problem. Consider a replicated "arithmetic service" which maintains a single number as its state (initialized to zero) and applies additions and multiplications to this value. The active-active approach might log out the transformations to apply, say "+1", "*2", etc. Each replica would apply these transformations and hence go through the same set of values. The "active-passive" approach would have a single master execute the transformations and log out the result, say "1", "3", "6", etc. This example also makes it clear why ordering is key for ensuring consistency between replicas: reordering an addition and multiplication will yield a different result.

The distributed log can be seen as the data structure which models the problem of consensus. A log, after all, represents a series of decisions on the "next" value to append. You have to squint a little to see a log in the Paxos family of algorithms, though log-building is their most common practical application. With Paxos, this is usually done using an extension of the protocol called "multi-paxos", which models the log as a series of consensus problems, one for each slot in the log. The log is much more prominent in other protocols such as ZAB, RAFT, and Viewstamped Replication, which directly model the problem of maintaining a distributed, consistent log.

My suspicion is that our view of this is a little bit biased by the path of history, perhaps due to the few decades in which the theory of distributed computing outpaced its practical application. In reality, the consensus problem is a bit too simple. Computer systems rarely need to decide a single value, they almost always handle a sequence of requests. So a log, rather than a simple single-value register, is the more natural abstraction.

Furthermore, the focus on the algorithms obscures the underlying log abstraction systems need. I suspect we will end up focusing more on the log as a commoditized building block irrespective of its implementation in the same way we often talk about a hash table without bothering to get in the details of whether we mean the murmur hash with linear probing or some other variant. The log will become something of a commoditized interface, with many algorithms and implementations competing to provide the best guarantees and optimal performance.
```

![active_and_passive_arch](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/active_and_passive_arch.png)

이 두 가지 접근 방식 차이를 이해하기 위해 간단한 예제를 보자.
하나의 숫자 상태(초기값 0)를 유지하면서 덧셈과 곱셈 연산을 적용하는 복제된 산술 서비스arthmetic service를 생각해보자.

active-active 방식에는 적용할 반환(예: "+1", "2" 등)을 로그에 기록한다. 각 복제본은 이러한 변환을 적용하므로 동일한 값의 집합을 거치게 된다.

반면, Active-Passive 방식에서는 단일 마스터가 반환을 실행하고 그 결과(예: "1", "3", "6" 등)를 로그에 기록한다. 이 예시는 또한 덧셈과 곱셈의 순서를 바꾸면 결과가 달라지기 때문에, 복제본 간 일관성을 보장하려면 순서ordering가 왜 중요한지도 명확히 보여준다.

분산 로그는 합의consensus 문제를 모델링하는 데이터 구조로 볼 수 있다. 결국 로그란, 다음에 추가할 값에 대한 일련의 결정(합의)을 나타내는 것이다. Paxos 계열 알고리즘에서 로그를 직접적으로 보기 위해서는 약간의 상상력이 필요하지만, 실제로 로그 구축은 이 알고리즘들의 가장 일반적인 실용적 응용이다. Paxos에서 보통 multi-paxos라 불리는 프로토콜 확장을 사용하여, 로그를 로그의 각 슬롯마다 하나씩 합의 문제를 푸는 일련의 문제로 모델링한다. 로그는 ZAB, RAFT, Viewstamped Replication과 같은 다른 프로토콜에서는 훨씬 더 두드러진 역할을 한다. 이들은 분산되고 일관성 있는 로그를 유지하는 문제 자체를 직접적으로 모델링한다.

내 생각에는, 우리가 이 문제를 바라보는 시각이 역사의 흐름에 의해 약간은 편향되어 있다. 아마도 분산 컴퓨팅 이론이 실제 응용보다 몇십 년 앞서 있었던 시기 때문일 것이다. 실제로 합의 문제는 너무 단순하다. 컴퓨터 시스템은 단일 값을 결정해야 하는 경우는 거의 없고, 거의 항상 일련의 요청(시퀀스)을 처리한다. 그래서 단순한 단일 값 레지스터single-value register보다는 로그가 더 자연스러운 추상화다.

더 나아가, 알고리즘에만 집중하다 보면 시스템이 실제로 필요로 하는 근본적인 로그 추상화가 가려질 수 있다. 나는 결국 우리가 해시 테이블에 대해 이야기 할 때 murmur hash에 선형 탐사linear probing를 쓰는지, 다른 변형을 쓰는지 신경 쓰지 않고 그저 해시 테이블이라는 인터페이스로 다루는 것처럼, 로그도 구현 방식과 상관없이 범용적인commoditized 빌딩 블록으로 다루게 될 것이라고 생각한다. 다양한 알고리즘과 구현체들이 최고의 보장과 최적의 성능을 제공하기 위해 경쟁하는 그런 범용 인터페이스가 될 것이다.

> **Notes**
> - **합의consensus 문제**
>   - 분산 시스템에서 여러 노트가 동일한 값을 결정(합의)해야 하는 문제다. Paxos, Raft, ZAB 등은 이 문제를 해결하기 위한 대표적인 알고리즘이다.
> - **Multi-Paxos**
>   - Paxos는 원래 단일 값에 대한 합의만 다루지만 실제 시스템에서는 연속된 값(로그의 각 슬롯)에 대해 합의가 필요하다. Multi-Paxos는 각 슬롯마다 Paxos 합의를 반복적으로 적용하여 전체 로그를 구성한다.
> - **log abstraction**
>   - 시스템이 내부적으로 어떤 알고리즘을 쓰든, 외부에서는 append-only, 순서가 보장된 로그라는 공통 인터페이스로 다루게 된다는 의미다. 해시 테이블이 내부 구현과 상관없이 표준 인터페이스로 쓰이는 것과 유사하다.

```
Changelog 101: Tables and Events are Dual
Let's come back to databases for a bit. There is a facinating duality between a log of changes and a table. The log is similar to the list of all credits and debits and bank processes; a table is all the current account balances. If you have a log of changes, you can apply these changes in order to create the table capturing the current state. This table will record the latest state for each key (as of a particular log time). There is a sense in which the log is the more fundamental data structure: in addition to creating the original table you can also transform it to create all kinds of derived tables. (And yes, table can mean keyed data store for the non-relational folks.)

This process works in reverse too: if you have a table taking updates, you can record these changes and publish a "changelog" of all the updates to the state of the table. This changelog is exactly what you need to support near-real-time replicas. So in this sense you can see tables and events as dual: tables support data at rest and logs capture change. The magic of the log is that if it is a complete log of changes, it holds not only the contents of the final version of the table, but also allows recreating all other versions that might have existed. It is, effectively, a sort of backup of every previous state of the table.

This might remind you of source code version control. There is a close relationship between source control and databases. Version control solves a very similar problem to what distributed data systems have to solve—managing distributed, concurrent changes in state. A version control system usually models the sequence of patches, which is in effect a log. You interact directly with a checked out "snapshot" of the current code which is analogous to the table. You will note that in version control systems, as in other distributed stateful systems, replication happens via the log: when you update, you pull down just the patches and apply them to your current snapshot.

Some people have seen some of these ideas recently from Datomic, a company selling a log-centric database. This presentation gives a great overview of how they have applied the idea in their system. These ideas are not unique to this system, of course, as they have been a part of the distributed systems and database literature for well over a decade.

This may all seem a little theoretical. Do not despair! We'll get to practical stuff pretty quickly.
```

### Changelog 101: 테이블과 이벤트는 쌍을 이룬다
잠시 다시 데이터베이스로 돌아가보자. 변경 로그와 테이블 사이에는 흥미로운 이중성이 존재한다. 로그는 모든 입금과 출금 그리고 은행의 처리 내역 전체 목록과 비슷하고 테이블은 모든 계좌의 현재 잔액과 같다. 만약 변경 로그가 있다면 이 변경사항들을 순서대로 적용해서 현재 상태를 담고 있는 테이블을 만들 수 있다. 이 테이블을 각 키에 대해(특정 로그 시점 기준으로) 최신 상태를 기록한다. 어떤 의미에서 로그가 더 근본적인 데이터 구조라고 할 수 있다. 원본 테이블을 만드는 것뿐만 아니라, 로그를 변환해서 다양한 파생 테이블derived tables도 만들 수 있기 때문이다.(그리고 비관계형 데이터베이스를 쓰는 사람들에게 테이블은 키값 저장소를 의미할 수도 있다.)

이 과정은 반대로도 작동한다. 만약 업데이트를 받는 테이블이 있다면, 이 변경사항들을 기록해서 테이블 상태의 모든 업데이트를 담은 변경 로그changelog를 발행할 수 있다. 이 변경 로그는 거의 실시간near real time 복제본을 지원하는 데 꼭 필요한 것이다. 이런 의미에서 테이블과 이벤트(로그)는 쌍을 이룬다고 볼 수 있다. 테이블은 정적인 데이터data at rest를, 로그는 변화chage를 포착한다. 로그의 마법은 만약 그것이 모든 변경의 완전한 로그라면 테이블의 최종 버전 뿐만 아니라 과거에 존재했던 모든 버전도 재구성할 수 있게 해준다는 점이다. 사실상 테이블의 모든 이전 상태를 백업해두는 것과 같다.

이것은 소스 코드 버전 관리를 떠올리게 할 수도 있다. 소스 관리와 데이터베이스 사이에는 밀접한 관계가 있다. 버전 관리 시스템은 분산 데이터 시스템이 해결해야 하는 문제와 매우 유사한 문제, 즉 분산되고 동시적인 상태 변화의 관리를 해결한다. 버전 관리 시스템은 보통 일련의 패치 시퀀스를 모델링하는데, 이것이 사실상 로그다. 사용자는 현재 코드의 스냅샷을 체크아웃해서 직접 다루는데, 이것이 테이블에 해당한다. 그리고 다른 분산 상태 시스템과 마찬가지로, 버전 관리 시스템에서도 복제는 로그를 통해 이루어진다. 업데이트 할 때는 패치만 받아서 현재 스냅샷에 적용한다.

최근 Datomic이라는 로그 중심 데이터베이스를 판매하는 회사에서 이런 아이디어를 본 사람도 있을 것이다. 이 프레젠테이션은 그들이 시스템에 이 아이디어를 어떻게 적용했는지 잘 보여준다. 물론 이런 아이디어는 이 시스템만의 것이 아니라 10년 넘게 분산 시스템과 데이터베이스 분야에서 논의되어 온 개념이다.

```
Part Two: Data Integration
Let me first say what I mean by "data integration" and why I think it's important, then we'll see how it relates back to logs.

Data integration is making all the data an organization has available in all its services and systems.
This phrase "data integration" isn't all that common, but I don't know a better one. The more recognizable term ETL usually covers only a limited part of data integration—populating a relational data warehouse. But much of what I am describing can be thought of as ETL generalized to cover real-time systems and processing flows.

You don't hear much about data integration in all the breathless interest and hype around the idea of big data, but nonetheless, I believe this mundane problem of "making the data available" is one of the more valuable things an organization can focus on.

Effective use of data follows a kind of Maslow's hierarchy of needs. The base of the pyramid involves capturing all the relevant data, being able to put it together in an applicable processing environment (be that a fancy real-time query system or just text files and python scripts). This data needs to be modeled in a uniform way to make it easy to read and process. Once these basic needs of capturing data in a uniform way are taken care of it is reasonable to work on infrastructure to process this data in various ways—MapReduce, real-time query systems, etc.

It's worth noting the obvious: without a reliable and complete data flow, a Hadoop cluster is little more than a very expensive and difficult to assemble space heater. Once data and processing are available, one can move concern on to more refined problems of good data models and consistent well understood semantics. Finally, concentration can shift to more sophisticated processing—better visualization, reporting, and algorithmic processing and prediction.

In my experience, most organizations have huge holes in the base of this pyramid—they lack reliable complete data flow—but want to jump directly to advanced data modeling techniques. This is completely backwards.

So the question is, how can we build reliable data flow throughout all the data systems in an organization?
```

## 데이터 통합
먼저 "데이터 통합"이라는 용어가 무엇을 의미하는지, 왜 중요하다고 생각하는지 설명한다. 그 다음 이것이 로그와 어떻게 연결되는지 살펴본다.

데이터 통합이란 조직이 보유한 모든 데이터를 모든 서비스와 시스템에서 사용할 수 있도록 만드는 것이다.

데이터 통합이라는 표현은 흔하지 않지만 이보다 더 나은 용어를 모르겠다. 더 익숙한 용어인 ETL은 보통 데이터 통합의 한정된 부분, 즉 관계형 데이터 웨어하우스에 데이터를 채우는 것만을 의미한다. 하지만 내가 설명하는 대부분의 내용은 ETL을 실시간 시스템과 처리 플로우까지 일반화한 것으로 볼 수 있다.

빅데이터에 대한 과장된 관심과 열광 속에서는 데이터 통합에 대해 많이 듣지 못하지만 그럼에도 나는 "데이터를 사용할 수 있게 만드는" 이 평범한 문제가 조직이 집중해야 할 가장 가치 있는 일 중 하나라고 믿는다.

데이터의 효과적인 활용은 일종의 마슬로우 욕구 단계Maslow's hierarchy of needs를 따른다. 피라미드 맨 아래에는 모든 관련 데이터를 수집하고 이를 적절한 처리 환경(고급 실시간 쿼리 시스템이든, 단순한 텍스트 파일과 파이썬 스크립트든)에 넣을 수 있는 능력이 있다. 이 데이터는 읽고 처리하기 쉽도록 일관된 방식으로 모델링되어야 한다. 데이터를 일관된 방식으로 수집하는 이러한 기본적인 요구가 충족되면, 그 다음에는 이 데이터를 다양한 방식으로 처리할 수 있는 인프라(MapReduce, 실시간 쿼리 시스템 등)를 구축하는 것이 합리적이다.

명백한 사실을 언급할 가치가 있다. 신뢰할 수 있고 완전한 데이터 흐름이 없다면 하둡 클러스터는 값비싸고 조립하기 어려운 난방기에 불과하다. 데이터와 처리가 가능해지면, 그 다음에는 더 정교한 데이터 모델과 일관성 있고 잘 이해된 의미론sementics에 대한 고민으로 넘어갈 수 있다. 마지막으로 더 고도화된 처리ㅡ더 나은 시각화, 리포팅, 알고리즘 처리 및 예측ㅡ에 집중할 수 있다.

내 경험상 대부분의 조직은 이 피라미드의 맨 아래에 큰 구멍이 있다. 즉, 신뢰할 수 있고 완전한 데이터 흐름이 부족하다. 그럼에도 불구하고 곧장 고급 데이터 모델링 기법으로 뛰어들고 싶어 한다. 이것은 완전히 거꾸로 된 접근이다.

그래서 질문은 이렇다. 조직 내 모든 데이터 시스템에 걸쳐 신뢰할 수 있는 데이터 흐름을 어떻게 구축할 수 있을까?

> **Notes**
> - **ETL(Extract, Transform, Load)**
>   - 데이터 소스에서 데이터를 추출하고 변환한 뒤, 데이터 웨어하우스 등 목적지에 적재하는 전통적인 데이터 처리 방식을 말한다.

```
Data Integration: Two complications
Two trends make data integration harder.

The event data firehose

The first trend is the rise of event data. Event data records things that happen rather than things that are. In web systems, this means user activity logging, but also the machine-level events and statistics required to reliably operate and monitor a data center's worth of machines. People tend to call this "log data" since it is often written to application logs, but that confuses form with function. This data is at the heart of the modern web: Google's fortune, after all, is generated by a relevance pipeline built on clicks and impressions—that is, events.

And this stuff isn't limited to web companies, it's just that web companies are already fully digital, so they are easier to instrument. Financial data has long been event-centric. RFID adds this kind of tracking to physical objects. I think this trend will continue with the digitization of traditional businesses and activities.

This type of event data records what happened, and tends to be several orders of magnitude larger than traditional database uses. This presents significant challenges for processing.

The explosion of specialized data systems

The second trend comes from the explosion of specialized data systems that have become popular and often freely available in the last five years. Specialized systems exist for OLAP, search, simple online storage, batch processing, graph analysis, and so on.

The combination of more data of more varieties and a desire to get this data into more systems leads to a huge data integration problem.
```

### 두 가지 복잡성
데이터 통합을 더 어렵게 만드는 두 가지 트렌드가 있다.

**쉴 새 없이 쏟아지는 이벤트 데이터**

첫 번째 흐름은 바로 이벤트 데이터의 급증이다. 이벤트 데이터는 어떤 ‘상태’를 기록하는 것이 아니라, ‘일어난 사건’ 자체를 기록한다. 웹 시스템을 예로 들면, 사용자의 활동 로그뿐만 아니라 데이터센터 내 수많은 장비를 안정적으로 운영하고 모니터링하는 데 필요한 시스템 레벨의 이벤트와 통계까지 모두 여기에 해당한다. 사람들은 종종 이런 데이터를 ‘로그 데이터’라고 부르곤 하는데, 주로 애플리케이션 로그 파일에 기록되기 때문일 것이다. 하지만 이는 데이터의 본질(기능)보다는 저장 형식(형태)에만 초점을 맞춘 표현이다. 사실 이 이벤트 데이터야말로 현대 웹 기술의 심장부라 할 수 있다. 구글의 막대한 수익도 결국 클릭과 노출 같은 이벤트 데이터를 기반으로 구축된 정교한 관련성 분석 파이프라인에서 나오기 때문이다.
이러한 흐름은 비단 웹 기업에만 국한된 이야기는 아니다. 웹 기업들이 이미 모든 것이 디지털화되어 있어 관련 데이터를 수집하고 분석하기(instrumentation)가 용이할 뿐이다. 금융 데이터는 오래전부터 이벤트 중심이었고, RFID 기술은 이제 현실 세계의 사물 추적까지 가능하게 한다. 나는 앞으로 전통적인 사업 영역과 활동들이 디지털화되면서 이러한 경향이 더욱 확산될 것이라고 본다.
이렇게 ‘무엇이 일어났는지’를 기록하는 이벤트 데이터는 그 양에 있어서 기존의 데이터베이스 활용 사례와는 비교할 수 없을 정도로 방대하다. 때로는 수십, 수백 배에 달하기도 한다. 이는 데이터 처리에 있어 엄청난 도전 과제를 안겨준다.

**특정 목적에 특화된 데이터 시스템의 범람**

두 번째 흐름은 지난 5년간 크게 늘어난 특화된 데이터 시스템들이다. 이들은 특정 목적에 맞춰져 있고, 무료로 제공되는 경우도 많다. OLAP(온라인 분석 처리), 검색, 간단한 온라인 저장소, 일괄 처리(batch processing), 그래프 분석 등 저마다 전문 분야를 가진 시스템들이다.
결국, 점점 더 다양해지는 데이터를 더 많은 종류의 시스템에서 활용하고자 하는 수요가 맞물리면서, 데이터 통합은 그야말로 거대한 난제가 되어가고 있다.

> **Notes**
> - **OLAP(Online Analytical Processing)**
>   - 온라인 분석 처리(Online Analytical Processing, OLAP)는 의사결정 지원 시스템 가운데 대표적인 예로, 사용자가 동일한 데이터를 여러 기준을 이용하는 다양한 방식으로 바라보면서 다차원 데이터 분석을 할 수 있도록 도와준다.(wikipedia)

```
Log-structured data flow
The log is the natural data structure for handling data flow between systems. The recipe is very simple:
Take all the organization's data and put it into a central log for real-time subscription.
Each logical data source can be modeled as its own log. A data source could be an application that logs out events (say clicks or page views), or a database table that accepts modifications. Each subscribing system reads from this log as quickly as it can, applies each new record to its own store, and advances its position in the log. Subscribers could be any kind of data system—a cache, Hadoop, another database in another site, a search system, etc.

For example, the log concept gives a logical clock for each change against which all subscribers can be measured. This makes reasoning about the state of the different subscriber systems with respect to one another far simpler, as each has a "point in time" they have read up to.

To make this more concrete, consider a simple case where there is a database and a collection of caching servers. The log provides a way to synchronize the updates to all these systems and reason about the point of time of each of these systems. Let's say we write a record with log entry X and then need to do a read from the cache. If we want to guarantee we don't see stale data, we just need to ensure we don't read from any cache which has not replicated up to X.

The log also acts as a buffer that makes data production asynchronous from data consumption. This is important for a lot of reasons, but particularly when there are multiple subscribers that may consume at different rates. This means a subscribing system can crash or go down for maintenance and catch up when it comes back: the subscriber consumes at a pace it controls. A batch system such as Hadoop or a data warehouse may consume only hourly or daily, whereas a real-time query system may need to be up-to-the-second. Neither the originating data source nor the log has knowledge of the various data destination systems, so consumer systems can be added and removed with no change in the pipeline.
```

### 로그 기반 데이터 흐름
로그는 시스템 간 데이터 흐름을 처리하기에 자연스러운 데이터 구조다. 방법은 간단하다.
조직의 모든 데이터를 중앙 로그에 넣고 실시간 구독이 가능하게 한다.
각 논리적 데이터 소스는 자체 로그로 모델링할 수 있다. 데이터 소스는 이벤트(예: 클릭, 페이지 뷰 등)를 기록하는 애플리케이션이 될 수도 있고, 변경을 수용하는 데이터 베이스 테이블이 될 수도 있다.
각 구독 시스템은 이 로그에서 가능한 빠르게 읽어와, 각 새로운 레코드를 자신의 저장소에 적용하고, 로그 내 자신의 위치를 앞으로 나아가게 한다.
구독자는 캐시, 하둡, 다른 사이트의 데이터베이스, 검색 시스템 등 어떤 종류의 데이터 시스템도 될 수 있다.

![log_subscription](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/log_subscription.png)

예를 들어, 로그 개념은 각 변경에 대해 모든 구독자가 측정할 수 있는 논리적 시계를 제공한다.
이로 인해 서로 다른 구독 시스템들의 상태를 서로 비교하고 이해하는 것이 훨씬 쉬워진다.
각 시스템이 어디까지 읽었는지 시점point in time을 갖기 때문이다.

좀 더 구체적으로 데이터베이스와 여러 캐싱 서버가 있는 단순한 경우를 생각해보자.
로그는 이 모든 시스템에 대한 업데이트를 동기화하고, 각 시스템의 시점ㅇ르 논리적으로 추론할 수 있는 방법을 제공한다.
예를 드어, 로그 엔트리 X에 해당하는 레코드를 쓴 후 캐시에서 읽기를 해야 한다고 하자. 만약 오래된 데이터stale data를 보지 않으려면 X까지 복제하지 않은 캐시에서는 읽지 않도록 보장하면 된다.

로그는 또한 데이터 생산과 소비를 비동기적으로 만들어주는 버퍼 역할도 한다.
이는 여러가지 이유로 중요하지만, 특히 여러 구독자가 서로 다른 속도로 데이터를 소비할 수 있을 때 더욱 그렇다.
즉, 구독 시스템이 장애가 나거나 유지보수로 내려가더라도, 다시 돌아오면 스스로 따라잡을 수 있다.
구독자는 자신이 제어하는 속도로 데이터를 소비한다. 하둡이나 데이터 웨어하우스 같은 배치 시스템은 한 시간이나 하루에 한 번만 데이터를 소비할 수 있고, 실시간 쿼리 시스템은 초 단위로 최신 데이터를 필요로 할 수 있다.
데이터 소스나 로그는 다양한 데이터 목적지 시스템에 대해 알 필요가 없으므로, 소비자 시스템은 파이프라인을 변경하지 않고도 자유롭게 추가하거나 제거할 수 있다.

```
Of particular importance: the destination system only knows about the log and not any details of the system of origin. The consumer system need not concern itself with whether the data came from an RDBMS, a new-fangled key-value store, or was generated without a real-time query system of any kind. This seems like a minor point, but is in fact critical.

I use the term "log" here instead of "messaging system" or "pub sub" because it is a lot more specific about semantics and a much closer description of what you need in a practical implementation to support data replication. I have found that "publish subscribe" doesn't imply much more than indirect addressing of messages—if you compare any two messaging systems promising publish-subscribe, you find that they guarantee very different things, and most models are not useful in this domain. You can think of the log as acting as a kind of messaging system with durability guarantees and strong ordering semantics. In distributed systems, this model of communication sometimes goes by the (somewhat terrible) name of atomic broadcast.

It's worth emphasizing that the log is still just the infrastructure. That isn't the end of the story of mastering data flow: the rest of the story is around metadata, schemas, compatibility, and all the details of handling data structure and evolution. But until there is a reliable, general way of handling the mechanics of data flow, the semantic details are secondary.
```

특히 중요한 점은, 데이터를 받는 쪽(목적지 시스템)은 오직 로그의 존재만 알면 될 뿐, 데이터가 원래 어디서 왔는지 그 출처 시스템의 세부 정보까지 알 필요 없다는 것이다.
즉, 데이터가 RDBMS에서 왔는지, 키-값 저장소에 왔는지 혹은 별도의 실시간 쿼리 시스템 없이 그냥 생성된 데이터인지 등을 데이터를 소비하는 시스템은 전혀 신경 쓸 필요가 없다. 이것은 사소해 보일 수 있지만 매우 핵심적인 부분이다.

내가 여기서 '메시징 시스템'이나 '발행-구독(pub-sub)' 대신 '로그'라는 용어를 사용하는 이유는, 로그가 의미론적으로 훨씬 더 구체적이고 실제 데이터 복제를 지원하는 데 필요한 요건들을 훨씬 더 정확하게 표현하기 때문이다.
내 경험상 '발행-구독'이라는 말은 그저 메시지가 간접적으로 전달된다는 것 이상의 의미를 담보하지 못하는 경우가 많다. 발행-구독 기능을 제공한다는 메시징 시스템을 비교해보면 실제 보장하는 내용은 제각각이고, 대부분의 모델은 이런 데이터 복제 영역에서는 별로 유용하지 않다.
로그는 내구성durability 보장과 강력한 순서 보장strong ordering semantics을 갖춘 특별한 종류의 메시징 시스템이라고 생각할 수 있다.
분산 시스템 분야에서는 이런 통신 모델을 (썩 좋은 이름은 아니지만) '원자적 브로드캐스트atomic broadcast'라고 부르기도 한다.

한 가지 강조하고 싶은 것은, 로그는 어디까지나 인프라일 뿐이라는 점이다. 데이터 흐름을 완전히 정복하는 이야기가 여기서 끝나는 것은 아니다.
그 나머지 이야기는 메타데이터, 스키마, 호환성, 그리고 데이터 구조와 그 변화를 다루는 온갖 세부 사항들에 관한 것이다. 하지만 데이터 흐름의 '기계적인 부분'을 안정적이고 보편적인 방식으로 처리할 방법이 마련되지 않는 한, 데이터의 '의미적인 세부 사항'들은 부차적인 문제일 수밖에 없다.

> **Notes**
> - **Atomic Broadcast**
>   - 분산 시스템에서 여러 노드에 메시지를 전달할 때, 모든 노드가 메시지를 받거나all-or-nothing, 만약 받는다면 모두 동일한 순서로 받도록 보장하는 통신 방식이다. 이것은 분산 환경에서 데이터 일관성을 유지하는 핵심 메커니즘이다.

```
At LinkedIn
I got to watch this data integration problem emerge in fast-forward as LinkedIn moved from a centralized relational database to a collection of distributed systems.
These days our major data systems include:

- Search
- Social Graph
- Voldemort (key-value store)
- Espresso (document store)
- Recommendation engine
- OLAP query engine
- Hadoop
- Terradata
- Ingraphs (monitoring graphs and metrics services)

Each of these is a specialized distributed system that provides advanced functionality in its area of specialty.

This idea of using logs for data flow has been floating around LinkedIn since even before I got here. One of the earliest pieces of infrastructure we developed was a service called databus that provided a log caching abstraction on top of our early Oracle tables to scale subscription to database changes so we could feed our social graph and search indexes.

I'll give a little bit of the history to provide context. My own involvement in this started around 2008 after we had shipped our key-value store. My next project was to try to get a working Hadoop setup going, and move some of our recommendation processes there. Having little experience in this area, we naturally budgeted a few weeks for getting data in and out, and the rest of our time for implementing fancy prediction algorithms. So began a long slog.

We originally planned to just scrape the data out of our existing Oracle data warehouse. The first discovery was that getting data out of Oracle quickly is something of a dark art. Worse, the data warehouse processing was not appropriate for the production batch processing we planned for Hadoop—much of the processing was non-reversable and specific to the reporting being done. We ended up avoiding the data warehouse and going directly to source databases and log files. Finally, we implemented another pipeline to load data into our key-value store for serving results.

This mundane data copying ended up being one of the dominate items for the original development. Worse, any time there was a problem in any of the pipelines, the Hadoop system was largely useless—running fancy algorithms on bad data just produces more bad data.

Although we had built things in a fairly generic way, each new data source required custom configuration to set up. It also proved to be the source of a huge number of errors and failures. The site features we had implemented on Hadoop became popular and we found ourselves with a long list of interested engineers. Each user had a list of systems they wanted integration with and a long list of new data feeds they wanted.
```

## 링크드인에서
링크드인이 중앙 집중식 관계형 데이터베이스에서 여러 분산 시스템으로 전환하는 과정을 지켜보면서 이러한 데이터 통합 문제가 어떻게 나타나는지 직접 목격할 수 있었다.

링크드인의 주요 데이터 시스템은 다음과 같다.
- 검색
- 소셜 그래프
- Voldmort (키-값 저장소)
- Espresso (문서 저장소)
- 추천 엔진
- OLAP 쿼리 엔진
- 하둡
- 테라데이터
- 모니터링 그래프 및 메트릭 서비스

이것들은 각각 특정 분야에서 고급 기능을 제공하는 전문화된 분산 시스템이다.

데이터 흐름에 로그를 사용한다는 아이디어는 내가 링크드인에 합류하기 전부터 논의되었다. 우리가 초기에 개발한 인프라 중 하나는 '데이터버스databus'라는 서비스였는데, 이는 초창기 Oracle 테이블 위에 로그 캐싱 추상화 계층을 제공하여 데이터베이스 변경 사항에 대한 구독을 확장하고, 이를 통해 소셜 그래프와 검색 인덱스에 데이터를 공급할 수 있도록 했다.

맥락을 제공하기 위해 약간의 역사를 설명하자면, 내 개인적인 참여(Jay Kreps가 이 프로젝트에 참여한 시기를 말함)는 2008년부터 시작됐다. 내 다음 프로젝트는 하둡 설정을 제대로 동작시키고, 일부 추천 프로세스를 그곳으로 옮기는 것이었다. 이 분야에 경험이 없었기 때문에 우리는 당연히 데이터 입출력에 몇 주를 할애하고 나머지 시간은 멋진 예측 알고리즘을 구현하는 데 사용하기로 계획했다. 그렇게 긴 고생길이 시작됐다.

우리는 원래 기존 Oracle 데이터 웨어하우스에서 데이터를 그냥 가져올 계획이었다. 가장 먼저 발견한 것은 Oracle에서 데이터를 빠르게 가져오는 것이 일종의 '어둠의 기술'과 같다는 점이다. 설상가상으로, 데이터 웨어하우스 처리는 우리가 하둡을 위해 계획했던 프로덕션 배치 처리에 적합하지 않았다. 대부분의 처리는 되돌릴 수 없었고 수행되는 리포팅 작업에 특화되어 있었다. 결국 우리는 데이터 웨어하우스를 피하고 원본 데이터베이스와 로그 파일로 직접 접근했다. 마지막으로 결과 제공을 위해 데이터를 키-값 저장소로 로드하는 또 다른 파이프라인을 구축했다.

이 평범한 데이터 복사 작업이 결국 초기 개발에서 가장 큰 비중을 차지하는 항목이었다. 더 나쁜 것은, 파이프라인 중 어느 하나라도 문제가 생기면 하둡 시스템은 거의 쓸모가 없다는 점이다. 잘못된 데이터로 멋진 알고리즘을 실행해봤자 더 많은 잘못된 데이터만 생상할 뿐이다.

비록 우리가 꽤 일반적인 방식으로 시스템을 구축했지만 각각의 새로운 데이터 소스는 설정을 위한 커스텀 구성이 필요했다. 또한 이것은 엄청난 수의 오류와 장애의 원인이 되기도 했다. 우리가 하둡에서 구현했던 사이트 기능들이 인기를 얻게 되면서 관심을 보이는 엔지니어들을 생겼다. 각 사용자는 자신들이 통합하고 싶은 시스템 목록과 원하는 새로운 데이터 피드 목록을 가지고 있었다.

```
A few things slowly became clear to me.

First, the pipelines we had built, though a bit of a mess, were actually extremely valuable. Just the process of making data available in a new processing system (Hadoop) unlocked a lot of possibilities. New computation was possible on the data that would have been hard to do before. Many new products and analysis just came from putting together multiple pieces of data that had previously been locked up in specialized systems.

Second, it was clear that reliable data loads would require deep support from the data pipeline. If we captured all the structure we needed, we could make Hadoop data loads fully automatic, so that no manual effort was expanded adding new data sources or handling schema changes—data would just magically appear in HDFS and Hive tables would automatically be generated for new data sources with the appropriate columns.

Third, we still had very low data coverage. That is, if you looked at the overall percentage of the data LinkedIn had that was available in Hadoop, it was still very incomplete. And getting to completion was not going to be easy given the amount of effort required to operationalize each new data source.

The way we had been proceeding, building out custom data loads for each data source and destination, was clearly infeasible. We had dozens of data systems and data repositories. Connecting all of these would have lead to building custom piping between each pair of systems something like this:

Note that data often flows in both directions, as many systems (databases, Hadoop) are both sources and destinations for data transfer. This meant we would end up building two pipelines per system: one to get data in and one to get data out.

This clearly would take an army of people to build and would never be operable. As we approached fully connectivity we would end up with something like O(N2) pipelines.

Instead, we needed something generic like this:

Note that data often flows in both directions, as many systems (databases, Hadoop) are both sources and destinations for data transfer. This meant we would end up building two pipelines per system: one to get data in and one to get data out.

This clearly would take an army of people to build and would never be operable. As we approached fully connectivity we would end up with something like O(N2) pipelines.

Instead, we needed something generic like this:

As much as possible, we needed to isolate each consumer from the source of the data. They should ideally integrate with just a single data repository that would give them access to everything.

The idea is that adding a new data system—be it a data source or a data destination—should create integration work only to connect it to a single pipeline instead of each consumer of data.

This experience lead me to focus on building Kafka to combine what we had seen in messaging systems with the log concept popular in databases and distributed system internals. We wanted something to act as a central pipeline first for all activity data, and eventually for many other uses, including data deployment out of Hadoop, monitoring data, etc.

For a long time, Kafka was a little unique (some would say odd) as an infrastructure product—neither a database nor a log file collection system nor a traditional messaging system. But recently Amazon has offered a service that is very very similar to Kafka called Kinesis. The similarity goes right down to the way partitioning is handled, data is retained, and the fairly odd split in the Kafka API between high- and low-level consumers. I was pretty happy about this. A sign you've created a good infrastructure abstraction is that AWS offers it as a service! Their vision for this seems to be exactly similar to what I am describing: it is the piping that connects all their distributed systems—DynamoDB, RedShift, S3, etc.—as well as the basis for distributed stream processing using EC2.
```

몇 가지 사실이 명확해지기 시작했다.

첫째, 우리가 구축한 파이프라인은 약간 엉성했지만, 실제로 매우 가치 있는 것이었다. 새로운 처리 시스템(하둡)에서 데이터를 사용할 수 있게 만드는 과정만으로도 많은 가능성이 열렸다.
이전에는 하기 어려웠던 데이터에 대한 새로운 계산이 가능해졌다. 많은 새로운 제품과 분석이 단순히 이전에 전문화된 시시ㅡ템에 갇혀 있떤 여러 데이터 조각을 결합하는 것만으로도 탄생했다.

둘째, 신뢰할 수 있는 데이터 로드는 데이터 파이프라인의 깊은 지원이 필요하다는 것이 명확해졌따. 우리가 필요한 모든 구조를 캡처할 수 있다면, 하둡 데이터 로드를 완전히 자동화할 수 있어서, 새로운 데이터 소스를 추가하거나 스키마 변경을 처리하는 데 수동적인 노력을 들이지 않아도 된다.
데이터는 마법처럼 HDFS에 나타나고, 새로운 데이터 소스에 대해 적절한 칼럼을 가진 Hive 테이블이 자동으로 생성된다.

셋째, 우리는 여전히 낮은 데이터 커버리지를 가지고 있었다. 즉, 링크드인이 보유한 전체 데이터 중에서 하둡에서 이용할 수 있는 데이터 비율을 살펴보면, 여전히 불완전했다. 그리고 각각 새로운 데이터 소스를 운영화하는 데 필요한 노력의 양을 고려할 때, 완전한 커버리지에 도달하는 것은 쉽지 않을 것이었다.

우리가 진행해왔던 방식, 즉 각 데이터 소스와 목적지에 대해 맞춤형 데이터를 구축하는 것은 명백히 실행 불가능했다. 우리에게는 수십 개의 데이터 시스템과 저장소가 있었다. 이 모든 것을 연결하는 것은 각 시스템 쌍 사이에 맞춤형 파이프라인을 구축하는 것으로 이어졌을 것이다. 대략 다음과 같은 모습으로:

![datapipeline_complex](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/datapipeline_complex.png)

데이터는 양방향으로 흐른다. 데이터베이스, 하둡이 데이터 전송 소스이자 대상이기 때문이다. 이는 결국 시스템 당 두 개의 파이프라인, 즉 데이터를 가져오는 파이프라인과 데이터를 내보내는 파이프라인을 구축해야 된다는 의미다.
이것은 엄청난 구축 비용이 든다. 모든 시스템을 다 연결하려고 하면, 연결해야 할 파이프라인 수가 시스템 수의 제곱에 비례해서 늘어나는 $O(N^{2})$ 상황이 된다. 예를 들어 시스템이 10개면 파이프라인은 100개가 필요한 식이다.

그래서 이런 방식 대신 좀 더 범용적인 구조가 필요했다.

![datapipeline_simple](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/datapipeline_simple.png)

가능한 한, 우리는 각 데이터 소비자를 데이터 원천으로부터 분리해야 했다. 이상적으로는 소비자들이 모든 데이터에 접근할 수 있는 단일 데이터 저장소와 통합해야 했다.

핵심 아이디어는 이렇다. 새로운 데이터 시스템을 추가할 때 ㅡ 그것이 데이터 소스이든 데이터 목적지data destination이든 ㅡ 각 데이터 소비자와 개별적으로 연결하는 작업을 하는 대신, 하나의 파이프라인에만 연결하는 통합 작업만으로 충분해야 한다는 것이다.

이러한 경험은 내가 메시징 시스템에서 보았던 것과 데이터베이스 및 분산 시스템 내부에서 널리 사용되는 로그 개념을 결합하여 카프카를 구축하는 데 집중하게 된 계기가 되었다. 우리는 모든 활동 데이터에 대한 중앙 파이프라인 역할을 할 무언가를 원했고, 결국에는 하둡에서 데이터를 배포하거나 모니터링 데이터를 처리하는 등 다른 많은 용도로도 확장되기를 바랐다.

오랫동안 카프카는 인프라 제품으로서 다소 독특한 존재였다. 데이터베이스도 아니고, 로그 파일 수집 시스템도 아니며, 전통적인 메시징 시스템도 아니었다. 그러나 최근 아마존은 키네시스라는 카프카와 매우 유사한 서비스를 제공하기 시작했다. 파티셔닝 처리 방식, 데이터 보존 방식, 그리고 카프카 API에서 고급 소비자high-level consumer와 저급 소비자low-level consumer 간 다소 특이한 구분 방식에 이르기까지 그 유사성은 놀라울 정도다.
이 서비스에 대한 그들의 비전은 내가 설명하는 것과 정확히 일치하는 것으로 보인다. 즉 키네시스는 그들의 모든 분산 시스템들을 연결하는 파이프라인이지 EC2를 사용한 분산 스트림 처리의 기반이 되는 것이다.


> **Notes**
> - **HDFS(Hadoop Distributed File System)**
>   - Hadoop의 분산 파일 시스템이다. 대용량 파일을 여러 서버에 나누어 저장하고, 각 파일 조각을 여러 서버에 복사해두어 하나의 서버가 고장나도 데이터가 손실되지 않도록 한다. 일반적인 컴퓨터 하드디스크처럼 파일을 저장하는 역할을 하지만, 수백 대 또는 수천 대 서버에 걸쳐 작동한다.
> - **Hive**
>   - Hive: Hadoop 위에서 작동하는 데이터 웨어하우스 소프트웨어다. HDFS에 저장된 대용량 데이터를 SQL과 유사한 언어로 쿼리할 수 있다.
>   - Hive Tables: Hive에서 데이터를 구조화하여 표현하는 방식. 관계형 데이터베이스의 테이블과 유사하게 행과 열로 구성되지만, 실제로는 HDFS에 저장된 파일들을 테이블 형태로 볼 수 있게 해주는 메타데이터 정보다.
> - **Data Converage**
>   - 전체 데이터 중에서 특정 시스템이나 프로세스가 다룰 수 있는 데이터의 비율을
> - **Custom Piping Between Each Pair of Systems**
>   - N개의 시스템이 있을 때, 각 시스템이 다른 모든 시스템과 직접 연결되려면 N*(N-1)/2개의 연결이 필요하다. 예를 들어 10개의 시스템이 있다면 45개의 서로 다른 연결을 만들어야 한다.
> - **고급 소비자High-Level Consumer**
>   - 카프카 메시지 소비를 자동화하고 쉽게 사용하도록 추상화된 API. 그룹 관리, 오프셋 관리 등을 자동으로 처리
> - **저급 소비자 (Low-Level Consumer / SimpleConsumer)**
>  - 메시지 소비 과정을 세밀하게 직접 제어할 수 있는 API. 특정 파티션/오프셋 지정, 수동 오프셋 관리. 유연하지만 복잡

```
Relationship to ETL and the Data Warehouse
Let's talk data warehousing for a bit. The data warehouse is meant to be a repository of the clean, integrated data structured to support analysis. This is a great idea. For those not in the know, the data warehousing methodology involves periodically extracting data from source databases, munging it into some kind of understandable form, and loading it into a central data warehouse. Having this central location that contains a clean copy of all your data is a hugely valuable asset for data-intensive analysis and processing. At a high level, this methodology doesn't change too much whether you use a traditional data warehouse like Oracle or Teradata or Hadoop, though you might switch up the order of loading and munging.

A data warehouse containing clean, integrated data is a phenomenal asset, but the mechanics of getting this are a bit out of date.
```

### ETL과 데이터 웨어하우스와의 관계
데이터 웨어하우스는 분석을 지원하기 위해 구조화된, 깨끗하고 통합된 데이터 저장소가 되도록 설계되었다. 잘 모르는 사람을 위해 설명하자면, 데이터 웨어하우증 방법론은 주기적으로 원본 베이스에서 데이터를 추출하고, 이를 이해할 수 있는 형태로 가공한 다음, 중앙 데이터 웨어하우스에 로드하는 것이다.
모든 데이터의 깨끗한 사본이 있는 이 중앙 위치는 데이터 집약적인 분석과 처리를 위한 매우 귀중한 자산이다. 큰 틀에서 이 방법론은 로딩과 정제Munging 순서를 바꿀 수는 있지만, Oracle, Teradata 또는 Hadoop과 같은 기존 데이터 웨어하우스를 사용하든, Oracle을 사용하든 크게 달라지지 않는다.
깨끗하고 통합된 데이터를 포함하는 데이터 웨어하우스는 놀라운 자산이지만, 이를 구축하는 메커니즘은 다소 시대에 뒤떨어진 면이 있다.

```
The key problem for a data-centric organization is coupling the clean integrated data to the data warehouse. A data warehouse is a piece of batch query infrastructure which is well suited to many kinds of reporting and ad hoc analysis, particularly when the queries involve simple counting, aggregation, and filtering. But having a batch system be the only repository of clean complete data means the data is unavailable for systems requiring a real-time feed—real-time processing, search indexing, monitoring systems, etc.

In my view, ETL is really two things. First, it is an extraction and data cleanup process—essentially liberating data locked up in a variety of systems in the organization and removing an system-specific non-sense. Secondly, that data is restructured for data warehousing queries (i.e. made to fit the type system of a relational DB, forced into a star or snowflake schema, perhaps broken up into a high performance column format, etc). Conflating these two things is a problem. The clean, integrated repository of data should be available in real-time as well for low-latency processing as well as indexing in other real-time storage systems.

I think this has the added benefit of making data warehousing ETL much more organizationally scalable. The classic problem of the data warehouse team is that they are responsible for collecting and cleaning all the data generated by every other team in the organization. The incentives are not aligned: data producers are often not very aware of the use of the data in the data warehouse and end up creating data that is hard to extract or requires heavy, hard to scale transformation to get into usable form. Of course, the central team never quite manages to scale to match the pace of the rest of the organization, so data coverage is always spotty, data flow is fragile, and changes are slow.

A better approach is to have a central pipeline, the log, with a well defined API for adding data. The responsibility of integrating with this pipeline and providing a clean, well-structured data feed lies with the producer of this data feed. This means that as part of their system design and implementation they must consider the problem of getting data out and into a well structured form for delivery to the central pipeline. The addition of new storage systems is of no consequence to the data warehouse team as they have a central point of integration. The data warehouse team handles only the simpler problem of loading structured feeds of data from the central log and carrying out transformation specific to their system.
```

데이터 중심 조직의 핵심 문제는 깨끗하게 통합된 데이터를 데이터 웨어하우스에만 국한시킨다는 점이다. 데이터 웨어하우스는 일괄 처리(batch) 쿼리 인프라의 일부로서, 특히 쿼리가 단순 집계, 합산, 필터링을 포함할 경우 다양한 리포팅 및 임시 분석ad hoc analysis에 효과적이다. 그러나 일괄 처리 시스템이 정제되고 완전한 데이터의 유일한 저장소가 된다는 것은, 실시간 피드를 필요로 하는 시스템들—실시간 처리, 검색 인덱싱, 모니터링 시스템 등—에서는 그 데이터를 활용할 수 없음을 의미한다.

내 관점에서 ETL은 실제로는 두 가지 요소를 포함한다. 첫째, 추출 및 데이터 정제 프로세스이다—이는 본질적으로 조직 내 다양한 시스템에 갇혀 있는 데이터를 해방시키고 각 시스템 특유의 불필요한 요소들을 제거하는 과정이다. 둘째, 이렇게 정제된 데이터는 데이터 웨어하우징 쿼리에 적합하도록 재구성된다 (가령, 관계형 데이터베이스의 타입 시스템에 맞추거나, 스타 스키마 또는 스노우플레이크 스키마 형태로 강제하거나, 때로는 고성능 컬럼 형식으로 분해하는 등). 이 두 가지를 혼동하는 것이 문제이다. 정제되고 통합된 데이터 저장소는 실시간으로도 사용 가능해야 하며, 지연 시간이 짧은 처리low-latency processing는 물론 다른 실시간 저장 시스템에서의 인덱싱에도 활용될 수 있어야 한다.

나는 이것이 데이터 웨어하우징 ETL을 조직적으로 훨씬 더 확장 가능하게 만드는 부가적인 이점을 제공한다고 생각한다. 데이터 웨어하우스 팀의 고질적인 문제는 조직 내 다른 모든 팀이 생성하는 모든 데이터를 수집하고 정제하는 책임을 맡는다는 점이다. 인센티브 구조가 어긋나 있다: 데이터를 생산하는 측data producers은 종종 데이터 웨어하우스에서 해당 데이터가 어떻게 사용되는지 명확히 인지하지 못하며, 결국 추출하기 어렵거나 사용 가능한 형태로 만들기 위해 규모를 키우기 어려운 과도한 변환이 필요한 데이터를 생성하게 된다. 당연하게도, 중앙 팀은 조직의 나머지 부분의 변화 속도에 맞춰 규모를 확장하는 데 항상 어려움을 겪으며, 그 결과 데이터 커버리지는 늘 부분적이고, 데이터 흐름은 취약하며, 변경 사항 반영은 느리다.

더 나은 접근법은 데이터를 추가하기 위한 잘 정의된 API를 갖춘 중앙 파이프라인, 즉 로그(log)를 마련하는 것이다. 이 파이프라인과 통합하고 깨끗하며 잘 구조화된 데이터 피드를 제공할 책임은 해당 데이터 피드의 생산자에게 있다. 이는 그들이 시스템 설계 및 구현 단계부터 데이터를 추출하여 중앙 파이프라인으로 전달하기 위한 잘 구조화된 형태로 만드는 문제를 고려해야 함을 의미한다. 새로운 저장 시스템의 추가는 데이터 웨어하우스 팀에게 큰 영향을 미치지 않는다. 왜냐하면 그들에게는 중앙 통합 지점이 있기 때문이다. 데이터 웨어하우스 팀은 중앙 로그로부터 구조화된 데이터 피드를 로드하고 자신들의 시스템에 특화된 변환을 수행하는, 상대적으로 더 단순한 문제만을 처리하게 된다.

> ****Notes**
> - **스타 스키마 (Star Schema) 및 스노우플레이크 스키마 (Snowflake Schema)**
>  - 데이터 웨어하우스에서 데이터를 구성하는 대표적인 모델링 방식이다.
>  - Star Schema: 중심에서 사실Fact 테이블을 두고, 그 주위에 여러 차원Dimension 테이블들이 별 모양처럼 연결된 구조다. 쿼리 성능이 좋고 이해하기 쉽다.
>  - Snowflake schema: 스타 스키마에서 차원 테이블을 더 정규화하여 여러 개 작은 테이블로 나눈 구조다. 눈꽃송이 모양과 비슷하며, 중복을 줄일 수 있지만 쿼리가 더 복잡해질 수 있다.

```
This point about organizational scalability becomes particularly important when one considers adopting additional data systems beyond a traditional data warehouse. Say, for example, that one wishes to provide search capabilities over the complete data set of the organization. Or, say that one wants to provide sub-second monitoring of data streams with real-time trend graphs and alerting. In either of these cases, the infrastructure of the traditional data warehouse or even a Hadoop cluster is going to be inappropriate. Worse, the ETL processing pipeline built to support database loads is likely of no use for feeding these other systems, making bootstrapping these pieces of infrastructure as large an undertaking as adopting a data warehouse. This likely isn't feasible and probably helps explain why most organizations do not have these capabilities easily available for all their data. By contrast, if the organization had built out feeds of uniform, well-structured data, getting any new system full access to all data requires only a single bit of integration plumbing to attach to the pipeline.

This architecture also raises a set of different options for where a particular cleanup or transformation can reside:

It can be done by the data producer prior to adding the data to the company wide log.
It can be done as a real-time transformation on the log (which in turn produces a new, transformed log)
It can be done as part of the load process into some destination data system
The best model is to have cleanup done prior to publishing the data to the log by the publisher of the data. This means ensuring the data is in a canonical form and doesn't retain any hold-overs from the particular code that produced it or the storage system in which it may have been maintained. These details are best handled by the team that creates the data since they know the most about their own data. Any logic applied in this stage should be lossless and reversible.

Any kind of value-added transformation that can be done in real-time should be done as post-processing on the raw log feed produced. This would include things like sessionization of event data, or the addition of other derived fields that are of general interest. The original log is still available, but this real-time processing produces a derived log containing augmented data.

Finally, only aggregation that is specific to the destination system should be performed as part of the loading process. This might include transforming data into a particular star or snowflake schema for analysis and reporting in a data warehouse. Because this stage, which most naturally maps to the traditional ETL process, is now done on a far cleaner and more uniform set of streams, it should be much simplified.
```

![pipeline_ownership](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/pipeline_ownership.png)

조직적 확장성에 대한 이러한 점은 전통적인 데이터 웨어하우스 외에 추가적인 데이터 시스템을 도입하는 것을 고려할 때 특히 중요해진다.
예를 들어, 조직의 전체 데이터셋에 대한 검색 기능을 제공하고자 한다고 가정해 보자. 또는, 실시간 트렌드 그래프와 알림 기능을 갖춘 초 단위 이하의 데이터 스트림 모니터링을 제공하고자 한다고 가정해 보자.
이 경우 모두 전통적인 데이터 웨어하우스나 심지어 하둡 클러스터의 인프라는 부적절할 것이다. 더 나쁜 것은, 데이터베이스 로드를 지원하기 위해 구축된 ETL 처리 파이프라인이 이러한 다른 시스템에 데이터를 공급하는 데는 거의 쓸모가 없어, 이러한 인프라 구성 요소를 처음부터 구축하는 것이 데이터 웨어하우스를 도입하는 것만큼이나 큰 작업이 된다는 점이다. 이는 아마도 실행 가능하지 않으며, 대부분의 조직이 모든 데이터에 대해 이러한 기능을 쉽게 사용할 수 없는 이유를 설명하는 데 도움이 될 것이다.
반대로, 만약 조직이 균일하고 잘 구조화된 데이터 피드를 구축했다면, 새로운 시스템이 모든 데이터에 대한 전체 접근 권한을 얻는 것은 파이프라인에 연결하기 위한 단 하나의 통합 배관 작업만 필요로 한다.

이 아키텍처는 또한 특정 정제 또는 변환 작업이 어디에 위치할 수 있는지에 대한 다양한 옵션을 제시한다.

1. 데이터 생산자가 데이터를 회사 전체 로그에 추가하기 전에 수행할 수 있다.
2. 로그에 대한 실시간 변환으로 수행될 수 있다. (이는 결국 새롭고 변환된 로그를 생성한다)
3. 어떤 목적지 데이터 시스템으로 로드하는 과정의 일부로 수행될 수 있다.

최상의 모델은 데이터 게시자가 로그에 데이터를 게시하기 전에 정제 작업을 수행하는 것이다. 이는 데이터가 표준 형식canonical form을 갖추고, 데이터를 생성한 특정 코드나 데이터가 유지되었을 수 있는 저장 시스템의 잔재를 보유하지 않도록 보장하는 것을 의미한다.
이러한 세부 사항은 자신들의 데이터에 대해 가장 잘 아는 데이터를 생성한 팀이 가장 잘 처리할 수 있다. 이 단계에서 적용되는 모든 로직은 무손실lossless이고 되돌릴 수 있어야reversible 한다.

실시간으로 수행될 수 있는 모든 종류의 부가가치 변환은 생성된 원시 로그 피드에 대한 후처리로 수행되어야 한다. 여기에는 이벤트 데이터의 세션화sessionization나 일반적으로 관심 있는 다른 파생 필드 추가 등이 포함될 수 있다. 원본 로그는 여전히 사용 가능하지만, 이 실시간 처리는 보강된 데이터를 포함하는 파생된 로그를 생성한다.

마지막으로 목적지 시스템에 특정한 집계만이 로딩 과정의 일부로 수행되어야 한다. 이는 데이터 웨어하우스에서 분석 및 리포팅을 위해 데이터를 특정 스타 또는 스노우플레이크 스키마로 변환하는 것을 포함할 수 있다.
가장 자연스럽게 전통적인 ETL 프로세스에 해당하는 이 단계는 이제 훨씬 깨끗하고 균일한 스트림 세트에 대해 수행되므로 훨씬 단순화 되어야 한다.


```
Log Files and Events
Let's talk a little bit about a side benefit of this architecture: it enables decoupled, event-driven systems.

The typical approach to activity data in the web industry is to log it out to text files where it can be scrapped into a data warehouse or into Hadoop for aggregation and querying. The problem with this is the same as the problem with all batch ETL: it couples the data flow to the data warehouse's capabilities and processing schedule.

At LinkedIn, we have built our event data handling in a log-centric fashion. We are using Kafka as the central, multi-subscriber event log. We have defined several hundred event types, each capturing the unique attributes about a particular type of action. This covers everything from page views, ad impressions, and searches, to service invocations and application exceptions.

To understand the advantages of this, imagine a simple event—showing a job posting on the job page. The job page should contain only the logic required to display the job. However, in a fairly dynamic site, this could easily become larded up with additional logic unrelated to showing the job. For example let's say we need to integrate the following systems:

We need to send this data to Hadoop and data warehouse for offline processing purposes
We need to count the view to ensure that the viewer is not attempting some kind of content scraping
We need to aggregate this view for display in the Job poster's analytics page
We need to record the view to ensure we properly impression cap any job recommendations for that user (we don't want to show the same thing over and over)
Our recommendation system may need to record the view to correctly track the popularity of that job
Etc
Pretty soon, the simple act of displaying a job has become quite complex. And as we add other places where jobs are displayed—mobile applications, and so on—this logic must be carried over and the complexity increases. Worse, the systems that we need to interface with are now somewhat intertwined—the person working on displaying jobs needs to know about many other systems and features and make sure they are integrated properly. This is just a toy version of the problem, any real application would be more, not less, complex.

The "event-driven" style provides an approach to simplifying this. The job display page now just shows a job and records the fact that a job was shown along with the relevant attributes of the job, the viewer, and any other useful facts about the display of the job. Each of the other interested systems—the recommendation system, the security system, the job poster analytics system, and the data warehouse—all just subscribe to the feed and do their processing. The display code need not be aware of these other systems, and needn't be changed if a new data consumer is added.
```

### 로그 파일과 이벤트
이 아키텍처의 부수적인 이점에 대해 잠시 이야기 해보겠다. 이것은 느슨하게 결합된, 이벤트 기반 시스템을 가능하게 한다.

웹 업계에서 활동 데이터에 대한 일반적인 접근 방식은 이를 텍스트 파일로 로깅하여 데이터 웨어하우스나 하둡으로 긁어모아 집계 및 쿼리하는 것이다. 이 문제점은 모든 일괄 처리 ETL의 문제점과 동일하다. 데이터 흐름이 데이터 웨어하우스의 기능과 처리 일정에 종속된다는 것이다.

링크드인에서, 우리는 로그 중심 방식으로 이벤트 처리를 구축했다. 우리는 Kafka를 중앙의 다중 구독자multi-subscriber 이벤트 로그로 사용하고 있다. 특정 유형의 행동에 대한 고유한 속성을 포착하는 수백 가지 이벤트 유형을 정의했다. 이는 페이지 뷰, 광고 노출, 검색에서부터 서비스 호출 및 애플리케이션 예외에 이르기까지 모든 것을 포괄한다.

이것의 장점을 이해하기 위해 간단한 이벤트를 상상해보자. 채용 공고 페이지에 채용 공고를 표시하는 것이다. 채용 공고 페이지에는 해당 공고를 표시하는 데 필요한 로직만 포함해야 한다. 그러나 상당히 동적인 사이트에서는 이것이 채용 공고 표시와 관련 없는 추가적인 로직으로 쉽게 복잡해질 수 있다. 예를 들어, 다음과 같은 시스템을 통합해야 한다고 가정해 보자.

- 오프라인 처리 목적으로 이 데이터를 하둡 및 데이터 웨어하우스로 보내야 한다.
- 조회 수를 계산하여 조회자가 어떤 종류의 콘텐츠 스크래핑을 시도하고 있지 않은지 확인해야 한다.
- 채용 공고 게시자의 분석 페이지에 표시하기 위애 이 조회를 집계해야 한다.
- 해당 사용자에 대한 채용 공고 추천이 적절히 노출 제한impression cap되도록 조회를 기록해야 한다. (동일한 것을 계속해서 보여주지 않기 위해)
- 우리의 추천 시스템은 해당 채용 공고의 인기도를 정확하게 추적하기 위해 조회를 기록해야 할 수도 있다.
- 기타 등등

곧, 채용 공고를 표시하는 단순한 행위가 매우 복잡해진다. 그리고 채용 공고가 표시되는 다른 장소들ㅡ모바일 앱 등ㅡ을 추가해야 한다면 이 로직은 그대로 옮겨져야 하고 복잡성은 증가한다.
더 나쁜 것은, 우리가 연동해야 하는 시스템이 이제 다소 뒤얽히게 된다는 것이다. 채용 공고 표시 작업을 하는 사람은 다른 많은 시스템과 기능에 대해 알아야 하고 그것이 제대로 통합되었는지 확인해야 한다. 이것은 문제의 아주 단순화된 버전일 뿐이며, 실제 애플리케이션은 이보다 덜 복잡한 것이 아니라 더 복잡할 것이다.

"이벤트 기반" 스타일은 이를 단순화하는 접근 방식을 제공한다. 이제 채용 공고 표시는 단순히 채용 공고를 보여주고, 해당 공고의 관련 속성 조회자, 그리고 해당 공고 표시에 대한 다른 유용한 사실들과 함께 채용 공고가 표시되었다는 사실을 기록하기만 하면 된다. 다른 관심 있는 시스템들ㅡ추천 시스템, 보안 시스템, 채용 공고 게시자 분석 시스템, 그리고 데이터 웨어하우스ㅡ은 모두 그저 피드를 구독하고 각저의 처리를 수행한다.
표시 코드는 이러한 다른 시스템들에 대해 알 필요가 없으며, 새로운 소비자가 추가되더라도 변경될 필요가 없다.

```
Building a Scalable Log
Of course, separating publishers from subscribers is nothing new. But if you want to keep a commit log that acts as a multi-subscriber real-time journal of everything happening on a consumer-scale website, scalability will be a primary challenge. Using a log as a universal integration mechanism is never going to be more than an elegant fantasy if we can't build a log that is fast, cheap, and scalable enough to make this practical at scale.

Systems people typically think of a distributed log as a slow, heavy-weight abstraction (and usually associate it only with the kind of "metadata" uses for which Zookeeper might be appropriate). But with a thoughtful implementation focused on journaling large data streams, this need not be true. At LinkedIn we are currently running over 60 billion unique message writes through Kafka per day (several hundred billion if you count the writes from mirroring between datacenters).

We used a few tricks in Kafka to support this kind of scale:

Partitioning the log
Optimizing throughput by batching reads and writes
Avoiding needless data copies
In order to allow horizontal scaling we chop up our log into partitions:

Each partition is a totally ordered log, but there is no global ordering between partitions (other than perhaps some wall-clock time you might include in your messages). The assignment of the messages to a particular partition is controllable by the writer, with most users choosing to partition by some kind of key (e.g. user id). Partitioning allows log appends to occur without co-ordination between shards and allows the throughput of the system to scale linearly with the Kafka cluster size.

Each partition is replicated across a configurable number of replicas, each of which has an identical copy of the partition's log. At any time, a single one of them will act as the leader; if the leader fails, one of the replicas will take over as leader.

Lack of a global order across partitions is a limitation, but we have not found it to be a major one. Indeed, interaction with the log typically comes from hundreds or thousands of distinct processes so it is not meaningful to talk about a total order over their behavior. Instead, the guarantees that we provide are that each partition is order preserving, and Kafka guarantees that appends to a particular partition from a single sender will be delivered in the order they are sent.

A log, like a filesystem, is easy to optimize for linear read and write patterns. The log can group small reads and writes together into larger, high-throughput operations. Kafka pursues this optimization aggressively. Batching occurs from client to server when sending data, in writes to disk, in replication between servers, in data transfer to consumers, and in acknowledging committed data.

Finally, Kafka uses a simple binary format that is maintained between in-memory log, on-disk log, and in network data transfers. This allows us to make use of numerous optimizations including zero-copy data transfer.

The cumulative effect of these optimizations is that you can usually write and read data at the rate supported by the disk or network, even while maintaining data sets that vastly exceed memory.

This write-up isn't meant to be primarily about Kafka so I won't go into further details. You can read a more detailed overview of LinkedIn's approach here and a thorough overview of Kafka's design here.
```

### 확장 가능한 로그 구축하기
물론, 발행자와 구독자를 분리하는 것은 새로운 개념이 아니다. 그러나 만약 소비자 규모 웹사이트에서 일어나는 모든 일에 대한 다중 구독자 실시간 저널 역할을 하는 커밋 로그를 유지하고 싶다면, 확장성이 주요 과제가 될 것이다. 로그를 보편적인 통합 메커니즘으로 사용하는 것은, 이를 대규모로 실용적으로 만들 만큼 충분히 빠르고, 저렴하며, 확장 가능한 로그를 구축할 수 없다면 우아한 환상에 지나지 않을 것이다.

시스템 분야 사람들은 일반적으로 분산 로그를 느리고 무거운 추상화로 생각한다. (그리고 보통 주키퍼가 적합할 수 있는 종류의 메타데이터 용도에만 연관 시킨다) 그러나 대용량 데이터 스트림을 저널링하는 데 초점을 맞춘 신중한 구현을 통해 이는 사실이 아닐 수도 있다. 링크드인에서 우리는 현재 하루에 600억 건 이상의 고유 메시지 쓰기를 Kafka를 통해 처리하고 있다.

우리는 Kafka에서 이러한 규모를 지원하기 위해 몇 가지 기법을 사용했다.

- 로그 파티셔닝
- 읽기 및 쓰기 배치를 통한 처리량 최적화
- 불필요한 데이터 복사 피하기

수평적 확장을 가능하게 하기 위해 우리는 로그를 파티션으로 나눈다.

![partitioned_log](https://content.linkedin.com/content/dam/engineering/en-us/blog/migrated/partitioned_log.png)

각 파티션은 완전히 순서가 정해진 로그이지만, 파티션 간에는 전역적인 순서가 (메시지에 포함할 수 있는 어떤 벽시계 시간wall clock time 정도를 제외하고) 없다. 메시지를 특정 파티션에 할당하는 것은 작성자가 제어할 수 없으며, 대부분의 사용자는 어떤 종류의 키로 파티셔닝 하는 것을 선택한다. 파티셔닝은 샤드 간 조정 없이 로그 추가가 발생하도록 하며, 시스템 처리량이 Kafka 클러스터 크기에 따라 선형적으로 확장될 수 있게 한다.

각 파티션은 설정 가능한 수의 복제본에 걸쳐 복제되며, 각 복제본은 해당 파티션 로그의 동일한 사본을 가진다. 어느 시점에서든, 그 중 하나가 리더 역할을 하며, 리더가 실패하면 복제본 중 하나가 리더로 대신하게 된다.

파티션 간 전역적인 순서가 없다는 것은 한계이지만, 우리는 이것이 주요한 문제라고 생각하지 않았다. 실제로, 로그와 상호작용은 일반적으로 수백 또는 수천 개의 서로 다른 프로세스로부터 발생하므로 그들의 행동에 대한 전체 순서를 논하는 것은 의미가 없다. 대신, 우리가 제공하는 보장은 각 파티션이 순서를 보존하며, Kafka는 단일 발신자로부터 특정 파티션으로 추가 전송된 순서대로 전달될 것을 보장한다는 것이다.

로그는 파일 시스템과 마찬가지로 선형적인 읽기 및 쓰기 패턴에 대해 최적화하기 쉽다. 로그는 작은 읽기와 쓰기를 더 크고 처리량이 높은 작업으로 그룹화할 수 있다. Kafka는 이러한 최적화를 적극적으로 추구한다. 데이터 전송 시 클라이언트에서 서버로, 디스크에 쓸 때, 서버 간 복제 시, 소비자로 데이터 전송 시, 그리고 커밋된 데이터를 확인할 때 배치가 발생한다.

마지막으로 Kafka는 인메모리 로그, 디스크 상의 로그, 그리고 네트워크 데이터 전송 간 유지되는 간단한 바이너리 형식을 사용한다. 이를 통해 제로 카피zero-copy 데이터 전송을 포함한 수많은 최적화를 사용할 수 있다.

이러한 최적화들의 누적 효과는 메모리를 훨씬 초과하는 데이터 세트를 유지하면서도 일반적으로 디스크나 네트워크가 지원하는 속도로 데이터를 읽고 쓸 수 있다는 것이다.

> **Notes**
> - Journaling
>  - 변경 사항이 실제 데이터에 적용되기 전에 그 변경 내용을 순차적으로 기록하는 것. 시스템 장애 시 이 기록(저널 또는 로그)을 사용해 데이터를 복구하거나 일관성을 유지할 수 있음.

```
Part Three: Logs & Real-time Stream Processing
So far, I have only described what amounts to a fancy method of copying data from place-to-place. But shlepping bytes between storage systems is not the end of the story. It turns out that "log" is another word for "stream" and logs are at the heart of stream processing.

But, wait, what exactly is stream processing?

If you are a fan of late 90s and early 2000s database literature or semi-successful data infrastructure products, you likely associate stream processing with efforts to build a SQL engine or "boxes and arrows" interface for event driven processing.

If you follow the explosion of open source data systems, you likely associate stream processing with some of the systems in this space—for example, Storm, Akka, S4, and Samza. But most people see these as a kind of asynchronous message processing system not that different from a cluster-aware RPC layer (and in fact some things in this space are exactly that).

Both these views are a little limited. Stream processing has nothing to do with SQL. Nor is it limited to real-time processing. There is no inherent reason you can't process the stream of data from yesterday or a month ago using a variety of different languages to express the computation.
```

## 로그와 실시간 스트림 처리
지금까지 나는 데이터를 이곳저곳으로 복사하는 약간 세련된 방법에 관해서만 기술했다. 그러나 스토리지 시스템 간에 바이트를 옮기는 것이 이야기의 전부는 아니다. '로그'는 '스트림'의 다른 말이며, 로그는 스트림 처리의 핵심이다.
그런데 스트림 처리란 정확히 무엇인가?
만약 당신이 90년대 후반과 2000년대 초반 데이터베이스 문헌이나 어느 정도 성공한 인프라 제품의 팬이라면, 당신은 스트림 처리를 이벤트 기반 처리를 위한 SQL 엔진 또는 '상자와 화살표Boxes and arrows interface' 인터페이스를 구축하려는 노려과 연관 지을 것이다.

만약 당신이 오픈 소스 데이터 시스템의 폭발적인 증가를 주시하고 있다면, 당신은 스트림 처리를 이 분야의 일부 시스템들ㅡ예를 들어, Storm, Akka, S4, Samzaㅡ과 연관 지을 것이다. 그러나 사람들 대부분은 이것을 클러스터 환경을 인지하는 RPC 계층과 크게 다르지 않은 일종의 비동기 메시지 처리 시스템으로 간주한다(그리고 실제로 이 분야의 일부는 정확히 그렇다).

이 두 가지 관점 모두 다소 제한적이다. 스트림 처리는 SQL과 아무런 관련이 없다. 또한 실시간 처리에만 국한되지도 않는다. 다양한 언어를 사용하여 계산을 표현하면서 어제 또는 한 달 전 데이터 스트림을 처리할 수 없는 본질적인 이유는 없다.

> **Notes**
> - Boxes and arrows interface
>  - GUI에서 데이터 처리 단계를 나타내는 상자(노드)들과 데이터 흐름을 나타내는 화살표(엣지)를 사용하여 사용자가 시각적으로 데이터 처리 파이프라인을 설계하고 구성할 수 있도록 하는 방식
> - Storm, Akka, S4, Samza
>  - 분산 환경에서 대량의 데이터 스트림을 실시간으로 처리하기 위한 오픈 소스 프레임워크 또는 플랫폼.
>  - Storm: 실시간 계산을 위한 분산형 내결함성 시스템.
>  - Akka: 동시성 및 분산 애플리케이션 구축을 위한 액터 기반 툴킷 및 런타임 (스트림 처리 모듈 포함).
>  - S4 (Simple Scalable Streaming System): 범용, 분산형, 확장 가능한, 플러그형 스트림 처리 플랫폼.
>  - Samza: Apache Kafka와 Hadoop YARN을 활용하는 분산 스트림 처리 프레임워크.
> - 클러스터 환경을 인지하는 RPC 계층 (Cluster-aware RPC layer):
>  - RPC (Remote Procedure Call): 한 프로그램이 네트워크상의 다른 컴퓨터에 있는 프로그램의 프로시저(함수)를 마치 로컬 프로시저처럼 호출할 수 있게 하는 기술.
>  - 클러스터 환경 인지: 분산된 여러 서버(클러스터) 환경에서 어떤 서버에 요청을 보내야 하는지, 서버 장애 시 어떻게 대처해야 하는지 등을 고려하여 RPC를 수행하는 기능.
>  - 일부 스트림 처리 시스템이 단순히 비동기적으로 메시지를 주고받으며 원격 프로시저를 호출하는 분산 시스템과 크게 다르지 않다는 비판적 시각을 나타냄.

```
I see stream processing as something much broader: infrastructure for continuous data processing. I think the computational model can be as general as MapReduce or other distributed processing frameworks, but with the ability to produce low-latency results.

The real driver for the processing model is the method of data collection. Data which is collected in batch is naturally processed in batch. When data is collected continuously, it is naturally processed continuously.

The US census provides a good example of batch data collection. The census periodically kicks off and does a brute force discovery and enumeration of US citizens by having people walking around door-to-door. This made a lot of sense in 1790 when the census was first begun. Data collection at the time was inherently batch oriented, it involved riding around on horseback and writing down records on paper, then transporting this batch of records to a central location where humans added up all the counts. These days, when you describe the census process one immediately wonders why we don't keep a journal of births and deaths and produce population counts either continuously or with whatever granularity is needed.

This is an extreme example, but many data transfer processes still depend on taking periodic dumps and bulk transfer and integration. The only natural way to process a bulk dump is with a batch process. But as these processes are replaced with continuous feeds, one naturally starts to move towards continuous processing to smooth out the processing resources needed and reduce latency.
```

나는 스트림 처리를 훨씬 더 광범위한 것, 즉 지속적인 데이터 처리를 위한 인프라로 본다. 계산 모델은 맵리듀스나 다른 분산 처리 프레임워크만큼 일반적일 수 있지만, 낮은 지연 시간으로 결과를 생성할 수 있는 능력을 갖추어야 한다고 생각한다.

처리 모델의 실제 동인은 데이터 수집 방법이다. 일괄batch로 수집된 데이터는 자연스럽게 일괄로 처리된다. 데이터가 지속적으로 수집될 때, 이는 자연스럽게 지속적으로 처리된다.

미국 인구 조사는 일괄 데이터 수집의 좋은 예시다. 인구 조사는 주기적으로 시작되어 사람들이 집집마다 돌아다니며 미국 시민을 무차별적으로 발견하고 열거한다. 인구 조사가 처음 시작된 1790년에는 이것이 매우 합리적이었다. 당시 데이터 수집은 본질적으로 일괄 지향적이었으며, 말을 타고 돌아다니며 종이에 기록을 작성한 다음, 이 기록 묶음을 중앙 위치로 옮겨 인간이 몯느 수를 합산하는 과정을 포함했다. 요즘 인구 조사를 설명하면 왜 우리가 출생 및 사망 기록을 유지하고 인구 수를 지속적으로 또는 필요한 세분화 수준으로 산출하지 않는지 즉시 의문을 갖게 된다.

이것은 극단적인 예이지만, 많은 데이터 전송 프로세스는 여전히 주기적은 덤프와 대량 전송 및 통합에 의존한다. 대량 덤프를 처리하는 유일한 자연스러운 방법은 일괄 프로세스를 사용하는 것이다. 그러나 이러한 프로세스가 지속적인 피드로 대체됨에 따라, 필요한 처리 리소스를 평탄화하고 지연 시간을 줄이기 위해 자연스럽게 지속적인 처리로 이동하기 시작한다.

```
LinkedIn, for example, has almost no batch data collection at all. The majority of our data is either activity data or database changes, both of which occur continuously. In fact, when you think about any business, the underlying mechanics are almost always a continuous process—events happen in real-time, as Jack Bauer would tell us. When data is collected in batches, it is almost always due to some manual step or lack of digitization or is a historical relic left over from the automation of some non-digital process. Transmitting and reacting to data used to be very slow when the mechanics were mail and humans did the processing. A first pass at automation always retains the form of the original process, so this often lingers for a long time.

Production "batch" processing jobs that run daily are often effectively mimicking a kind of continuous computation with a window size of one day. The underlying data is, of course, always changing. These were actually so common at LinkedIn (and the mechanics of making them work in Hadoop so tricky) that we implemented a whole framework for managing incremental Hadoop workflows.

Seen in this light, it is easy to have a different view of stream processing: it is just processing which includes a notion of time in the underlying data being processed and does not require a static snapshot of the data so it can produce output at a user-controlled frequency instead of waiting for the "end" of the data set to be reached. In this sense, stream processing is a generalization of batch processing, and, given the prevalence of real-time data, a very important generalization.
```

예를 들어, 링크드인은 배치 데이터 수집이 거의 없다.우리 데이터의 대부분은 활동 데이터이거나 데이터베이스 변경 사항이며, 이 두 가지 모두 지속적으로 발생한다. 사실, 어떤 비즈니스에 대해 생각해 보면, 그 기본 메커니즘은 거의 항상 연속적인 프로세스다.잭 바우어가 말했듯이 이벤트는 실시간으로 발생한다. 데이터가 배치로 수집될 때는 거의 항상 어떤 수동 단계나 디지털화의 부족 때문이거나, 비디지털 프로세스의 자동화에서 남은 역사적 유물 때문이다. 우편으로 처리하던 시절에는 데이터를 전송하고 반응하는 것이 매우 느렸다. 자동화의 첫 번째 시도는 항상 원래 프로세스의 형태를 유지하므로, 이는 종종 오랫동안 남아 있다.

매일 실행되는 프로덕션 배치 처리 작업은 종종 1일의 윈도우 크기를 가진 일종의 연속적인 계산을 효과적으로 모방한다. 물론 기본 데이터는 항상 변경된다. 링크드인에서는 이러한 작업이 매우 흔했고 (그리고 Hadoop에서 이를 작동시키는 메커니즘이 매우 까다로웠기 때문에) 증분 Hadoop 워크플로우를 관리하기 위한 전체 프레임워크를 구현했다.

이런 관점에서 보면 스트림 처리에 대해 다른 시각을 갖기 쉽다. 스트림 처리는 처리되는 기본 데이터에 시간 개념을 포함하고 데이터의 정적 스냅샷을 요구하지 않으므로 데이터 세트의 끝에 도달하기를 기다리는 대신, 사용자가 제어하는 빈도로 출력을 생성할 수 있는 처리 방식이다. 이런 의미에서 스트림 처리는 배치 처리의 일반화이며, 실시간 데이터의 보편성을 고려할 때 매우 중요한 일반화이다.

```
So why has the traditional view of stream processing been as a niche application? I think the biggest reason is that a lack of real-time data collection made continuous processing something of an academic concern.

I think the lack of real-time data collection is likely what doomed the commercial stream-processing systems. Their customers were still doing file-oriented, daily batch processing for ETL and data integration. Companies building stream processing systems focused on providing processing engines to attach to real-time data streams, but it turned out that at the time very few people actually had real-time data streams. Actually, very early at my career at LinkedIn, a company tried to sell us a very cool stream processing system, but since all our data was collected in hourly files at that time, the best application we could come up with was to pipe the hourly files into the stream system at the end of the hour! They noted that this was a fairly common problem. The exception actually proves the rule here: finance, the one domain where stream processing has met with some success, was exactly the area where real-time data streams were already the norm and processing had become the bottleneck.

Even in the presence of a healthy batch processing ecosystem, I think the actual applicability of stream processing as an infrastructure style is quite broad. I think it covers the gap in infrastructure between real-time request/response services and offline batch processing. For modern internet companies, I think around 25% of their code falls into this category.

It turns out that the log solves some of the most critical technical problems in stream processing, which I'll describe, but the biggest problem that it solves is just making data available in real-time multi-subscriber data feeds. For those interested in more details, we have open sourced Samza, a stream processing system explicitly built on many of these ideas. We describe a lot of these applications in more detail in the documentation here.
```

그렇다면 왜 스트림 처리에 대한 전통적인 관점은 틈새niche 애플리케이션으로 여겨졌을까? 가장 큰 이유는 실시간 데이터 수집의 부재가 연속적인 처리를 다소 학문적인 관심사로 만들었기 때문이라고 생각한다.

실시간 데이터 수집 부족이 상용 스트림 처리 시스템을 실패하게 만든 주요 원인일 가능성이 높다고 생각한다. 그들의 고객은 여전히 ETL 및 데이터 통합을 위해 파일 중심의 일일 배치 처리를 하고 있다. 스트림 처리 시스템을 구축하는 회사들은 실시간 데이터 스트림에 연결할 처리 엔진을 제공하는 데 중점을 두었지만, 당시에는 실제로 실시간 데이터 스트림을 가진 사람이 거의 없었다는 것이 드러났다. 사실 링크드인에서 내 경력 초기에 한 회사가 우리에게 매우 멋진 스트림 처리 시스템을 판매하려고 시도했지만, 당시 우리 모든 데이터는 시간별 파일로 수집되었기 때문에 우리가 생각해낼 수 있었던 최선의 애플리케이션은 매시간 말에 시간별 파일을 스트림 시스템으로 파이프 하는 것뿐이었다. 그들은 이것이 상당히 일반적인 문제라고 언급했다. 예외가 실제로 규칙을 증명하는 경우인데, 스트림 처리가 어느 정도 성공을 거둔 유일한 분야인 금융은 실시간 데이터 스트림이 이미 표준이었고 처리가 병목 현상이 된 바로 그 영역이었다.

건강한 배치 처리 생태계가 존재하더라도, 인프라 스타일로서 스트림 처리의 실제 적용 가능성은 상당히 넓다. 이는 실시간 요청/응답 서비스와 오프라인 배치 처리 사이의 인프라 격차를 메운다고 생각한다. 현대 인터넷 기업의 경우, 코드의 약 25%가 이 범주에 속한다고 생각한다.

로그는 스트림 처리에서 가장 중요한 기술적 문제 중 일부를 해결하는데, 이에 대해서는 설명하겠지만, 로그가 해결하는 가장 큰 문제는 실시간 다중 구독자 데이터 피드를 통해 데이터를 사용할 수 있게 만드는 것이다.
