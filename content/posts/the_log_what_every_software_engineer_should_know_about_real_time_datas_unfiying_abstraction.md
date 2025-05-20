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

